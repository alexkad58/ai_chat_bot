require('dotenv').config()
const axios = require('axios');
const fs = require('fs')
const { HttpsProxyAgent } = require('https-proxy-agent');
const { sleep } = require('./helpers');
const generateRequestOptions = require('./generateRequestOptions');
const sendMessage = require('./sendMessage');
const logger = require('./logger');

const proxyUrl = 'http://ugdxwxma:crh5c5ve654k@64.137.42.112:5157';
const agent = new HttpsProxyAgent(proxyUrl);

const anthropicEndpoint = 'https://api.anthropic.com/v1/messages/batches'
const anthropicApiKey = process.env.API_KEY;
const model = 'claude-3-5-sonnet-latest';

const sendAnthropicMessageBatchesRequest = async (requestsArray, client) => {
    try {  
        const response = await axios.post(
            anthropicEndpoint,
            {
                requests: requestsArray
            },
            {
                headers: {
                    'x-api-key': anthropicApiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'message-batches-2024-09-24',
                    'Content-Type': 'application/json'
                },
                httpsAgent: agent
            }
        );

        const resId = response.data.id
        client.cache.requestsToCheck.push(resId)
    } catch (error) {
        logger(`[api] Ошибка при отправке запроса в Anthropics: ${error.message}`, client)
    }
}

const sendAnthropicRequest = async (options, client) => {
    const anthropicEndpoint = 'https://api.anthropic.com/v1/messages';
    try {
        const response = await axios.post(
            anthropicEndpoint,
            options.params,
            {
                headers: {
                    'x-api-key': anthropicApiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                httpsAgent: agent,
            }
        );

        console.log(response.data.content[0].text)
        sendReplies([{
            responce_text: response.data.content[0].text,
            chat_id: options.custom_id
        }], client)
    } catch (error) {
        logger(`[api] Ошибка при запросе к Anthropics: ${error.message}`, client)
    }
}

const sendReplies = async (responses, client) => {
    logger(`[бот] Отправляю ответы...`, client)
    responses.forEach(async (res) => {
        try {
            const responce = JSON.parse(res.responce_text)
            if (!responce.main) return

            for await (const responseObj of responce.main) {
                const chatId = res.chat_id
                const messageId = responseObj.reply_message_id

                const chatInput = await client.getEntity(chatId)
                await sendMessage(responseObj.reply_text, chatInput, client, Number(messageId))

                await client.db.push(`/chats/${chatId}[]`, {
                    role: 'assistant',
                    content: `[reply_user_id:${responseObj.reply_user_id}|reply_message_id:${messageId}] ${responseObj.reply_text}`
                })

                await client.db.push(`/users/${responseObj.reply_user_id}[]`, {
                    role: 'user',
                    content: responseObj.reply_message_text
                })

                await client.db.push(`/users/${responseObj.reply_user_id}[]`, {
                    role: 'assistant',
                    content: `[reply_user_id:${responseObj.reply_user_id}|reply_message_id:${messageId}] ${responseObj.reply_text}`
                })
            }
        } catch (error) {
            logger(`[бот] Ошибка при отправке ответов: ${error.message}`, client)
        }
    })
}

const generateRequests = async (client) => {
    const users = await client.db.getData(`/users`);
    const requestsArr = [];
    const mainSystem = fs.readFileSync('./config/system.txt').toString();
    client.cache.requestsToSend.forEach(async (options) => {
        const usersHistory = {};
        try {
            for (const userId in users) {
                if (!options.usersIds.includes(userId)) continue
                 usersHistory[userId] = users[userId]
                 usersHistory[userId].slice(-client.cache.config.userHistorySize);
            }
        } catch (error) {
            logger(`[бот] Ошибка получения информации юзера: ${error.message}`, client)
        }
        let system = mainSystem
        .replace('<chatPrompt>', options.chatPrompt)
        .replace('<usersInfo>', JSON.stringify(options.usersInfo, null, 2))
        .replace('<usersHistory>', JSON.stringify(usersHistory, null, 2));
        requestsArr.push({
            custom_id: options.chatId,
            params: {
                model: model,
                max_tokens: 1024,
                system: system,
                messages: options.history
            }
        })
        logger(`[бот] Реквесты собраны.`, client)
    })

    client.cache.requestsToSend = []
    return requestsArr
}

const getResults = async (resUrl, client) => {
    logger(`[api] [${resUrl}] Получаю результаты...`, client)
    try {
        const result = await axios.get(resUrl, {
            headers: {
                'x-api-key': anthropicApiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-beta': 'message-batches-2024-09-24'
            },
            httpsAgent: agent
        });
    
        if (result.data?.result?.type != 'succeeded') return logger(`[api] [${resUrl}] Статус запроса оказался неудачным: ${result.data.result.type}`, client)
    
        const replies = []
        result.data.result.message.content.forEach(content => {
            const text = content.text
            const chatId = result.data.custom_id
    
            replies.push({
                responce_text: text,
                chat_id: chatId
            })
        })
    
        sendReplies(replies, client)
    } catch (error) {
        logger(`[api] [${resUrl}] Ошибка при получении результатов: ${error.message}`, client)
    }
}

const startCheckerCycle = async (client) => {
    logger(`[бот] Запускаю цикл проверки запросов.`, client)
    while (true) {
        await sleep(client.cache.config.cycleTimer || 60000)
        console.log(client.cache.requestsToCheck)
        if (!client.cache.requestsToCheck[0]) continue;

        const check = await axios.get(`${anthropicEndpoint}/${client.cache.requestsToCheck[0]}`, {
            headers: {
                'x-api-key': anthropicApiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-beta': 'message-batches-2024-09-24'
            },
            httpsAgent: agent
        });
        console.log(`[api] статус ответа: ${check.data.processing_status}`)
        if (check.data.processing_status == 'ended') {
            client.cache.requestsToCheck.shift()
            resUrl = check.data.results_url
            getResults(resUrl, client)
        }
    }
}

const startApiSender = async (client) => {
    logger(`[бот] Запускаю цикл отправки запросов.`, client)
    while (true) {
        await sleep(client.cache.config.cycleTimer || 60000)
        for (const chatId in client.cache.history.chats) {
            if (!client.cache.history.chats.hasOwnProperty(chatId)) continue;

            let history = client.cache.history.chats[chatId];
            const historyLength = history.length
            if (historyLength == 0) continue;

            const howMuchNeed = client.cache.config.chatHistorySize - historyLength
            if (howMuchNeed > 0) {
                let fullHistory
                try {
                    fullHistory = await client.db.getData(`/chats/${chatId}`)
                    lastHsitoryToAdd = fullHistory.slice(-howMuchNeed)
                    history = [...lastHsitoryToAdd, ...history]
                } catch (error) {
                    
                }
            }

            const options = await generateRequestOptions(history, chatId, client)
            client.cache.requestsToSend.push(options)

            client.cache.history.chats[chatId].forEach(async (messageUnit) => {
                let newMessageUnit = messageUnit
                newMessageUnit.seen = true
                await client.db.push(`/chats/${chatId}[]`, newMessageUnit)
            })
            client.cache.history.chats[chatId] = []
        }

        if (client.cache.requestsToSend.length == 0) continue;

        logger(`[бот] Генерирую реквесты...`, client)
        const requestsArray = await generateRequests(client)
        logger(`[бот] Рассылаю запросы...`, client)
        requestsArray.forEach((options, index) => {
            if (options.custom_id != client.cache.config.testChannel) return
            requestsArray.splice(index, 1)
            sendAnthropicRequest(options, client)
        })

        if (requestsArray[0])
        sendAnthropicMessageBatchesRequest(requestsArray, client)
    }
}

module.exports = { sendAnthropicRequest, startApiSender, startCheckerCycle };