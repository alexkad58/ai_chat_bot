const config = require('./config.json');
require('dotenv').config()
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require('telegram/events');
const { JsonDB, Config } = require('node-json-db');
const { HttpsProxyAgent } = require('https-proxy-agent')
const fs = require('fs');
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const axios = require('axios');

const proxyUrl = 'http://ugdxwxma:crh5c5ve654k@64.137.42.112:5157';
const agent = new HttpsProxyAgent(proxyUrl);

// Настройки запроса к API Anthropics
const anthropicApiKey = process.env.AI_KEY;
const anthropicEndpoint = 'https://api.anthropic.com/v1/messages';
const model = 'claude-3-haiku-20240307';

let WORKING = true

const sendAnthropicRequest = async (prompt) => {
    try {
        const response = await axios.post(
            anthropicEndpoint,
            {
                model: model,
                max_tokens: 1024,
                system: prompt.system,
                messages: prompt.messages
            },
            {
                headers: {
                    'x-api-key': anthropicApiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                httpsAgent: agent  // Добавляем прокси-агент
            }
        );
        
        console.log('Ответ от Anthropics:', response.data);
        return response.data.content[0].text
    } catch (error) {
        console.error('Ошибка при отправке запроса в Anthropics:', error.message);
    }
}

const apiId = config.bot.appId;
const apiHash = config.bot.apiHash;
const stringSession = new StringSession(config.bot.stringSession);
const TGclient = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
const db = new JsonDB(new Config("db", true, true, '/'));
TGclient.db = db;

const updateSessionString = (session) => {
    config.bot.stringSession = session;
    fs.writeFile('config.json', JSON.stringify(config), 'utf8', (err) => {
        if (err) throw err;
        console.log('Сессия записана.');
    });
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const sendMessage = async (chatId, message) => {
    await TGclient.sendMessage(chatId, { message });
};

const getRndInteger = (min, max) => {
    return Math.floor(Math.random() * (max - min) ) + min;
  }

const setPrompt = async (chatInput, message, media) => {
    const args = message.split(' ');
    const configTg = await TGclient.db.getData('/configTg');

    const handlePromptError = async () => {
        await sendMessage(chatInput, 'Неправильное использование команды.\nИспользуйте: /prompt [g] [юзернейм | id_чата] + файл .txt');
    };

    const updateConfig = async () => TGclient.db.push('/configTg', configTg);

    let textPrompt = ''
    if (media) {
        try {
            const bufferPrompt = await TGclient.downloadMedia(media, './tempPrompt.txt');
            textPrompt = bufferPrompt.toString('utf8')
        } catch (error) {
            console.error('Ошибка при загрузке файла:', error);
        }
    } else return handlePromptError();

    if (args[1] === 'g') {
        configTg.prompts.global = textPrompt;
    } else {
        const target = args[1];
        if (isNaN(target)) {
            try {
                const userEntity = await TGclient.getEntity(target);
                configTg.prompts[userEntity.id] = textPrompt;
            } catch (error) {
                console.log('Ошибка:', error.message);
            }
        } else {
            configTg.prompts[target] = textPrompt;
        }
    }

    await updateConfig();
    await sendMessage(chatInput, '[bot] промпт успешно установлен');
};

const setSystem = async (chatInput, message, media) => {
    const args = message.split(' ');
    const configTg = await TGclient.db.getData('/configTg');

    const handleSystemError = async () => {
        await sendMessage(chatInput, 'Неправильное использование команды.\nИспользуйте: /system + файл .txt');
    };

    const updateConfig = async () => TGclient.db.push('/configTg', configTg);

    let textSystem = ''
    if (media) {
        try {
            const bufferSystem = await TGclient.downloadMedia(media, './tempSystem.txt');
            textSystem = bufferSystem.toString('utf8')
        } catch (error) {
            console.error('Ошибка при загрузке файла:', error);
        }
    } else return handleSystemError();

    configTg.prompts.system = textSystem;

    await updateConfig();
    await sendMessage(chatInput, '[bot] системный промпт успешно установлен');
};

const changeStatus = async (chatInput, bool) => {
    WORKING = bool,
    await sendMessage(chatInput, `[bot] статус работы бота: ${bool}`);
}

const setDeep = async (chatInput, message) => {
    const [_, chatGlobal, chatUser] = message.split(' ').map(Number);
    if (!chatGlobal || !chatUser) return;

    const configTg = await TGclient.db.getData('/configTg');
    configTg.chatGlobal = chatGlobal;
    configTg.chatUser = chatUser;
    await TGclient.db.push('/configTg', configTg);
    await sendMessage(chatInput, '[bot] значения глубины успешно сохранены');
};

const setTime = async (chatInput, message) => {
    const [_, first, second] = message.split(' ').map(Number);
    if (!first || !second) return;

    const configTg = await TGclient.db.getData('/configTg');
    configTg.timer = [first, second];
    await TGclient.db.push('/configTg', configTg);
    await sendMessage(chatInput, '[bot] значения таймера успешно сохранены');
}

const getId = async (chatInput, messageId, chatId) => {
    await TGclient.deleteMessages(chatInput, [Number(messageId)], true);
    await sendMessage('me', `[bot] \`${chatId}\``);
};

const shouldReply = async (message, mainHistory, userHistory, chatPrompt, systemPrompt) => {
    // console.log(chatPrompt)
    const systemData = `Входные данные:
        Вот история последних сообщений: ${mainHistory}.
        Вот история общения с автором сообщения: ${userHistory}.
        Вот сообщение на которое ды должен ответить или не отвечать: ${message}.\n`
    const systemConfig = chatPrompt
    const systemFinal = `\nТвоя задача: На основе этих данных прими решение, отвечать на сообщение или нет, и ответь ТОЛЬКО в формате JSON (без new line символа, чтобы можно было запарсить из строки в json):
        { "isReply": boolean, "text": string }
        Поле isReply: установи в true, если считаешь нужным ответить, и в false, если ответ не требуется.
        Поле text: заполни текстом ответа только если isReply равно true. В противном случае оставь text пустым.`

    const system = systemData + systemConfig + systemFinal
    const prompt = {}
    if (userHistory) {
        prompt.messages = userHistory.flatMap(obj => [
            { role: 'user', content: obj.user },
            { role: 'assistant', content: obj.assistant }
        ]);
    } else {
        prompt.messages = []
    }
    
    prompt.messages.push({ role: 'user', content: message })
    prompt.text = message
    prompt.system = system
    const reply = await sendAnthropicRequest(prompt)

    return JSON.parse(reply);
};

const handleUser = async (event, chatInput, userId) => {
    if (!WORKING) return
    try {
        const configTg = await TGclient.db.getData(`/configTg`);
        const savedUsers = await TGclient.db.getData(`/savedUsers`);

        if (!savedUsers.includes(userId)) {
            await TGclient.db.push(`/savedUsers[]`, userId);
            await TGclient.db.push(`/chats/${userId}`, []);
        }

        const chatHistory = await TGclient.db.getData(`/chats/${userId}`);
        if (chatHistory.length >= configTg.chatGlobal) chatHistory.shift();

        let userPrompt = ''
        const prompts = await TGclient.db.getData('/configTg/prompts')
        if (!prompts[userId]) return
        userPrompt = prompts[userId]
        
        const reply = await sendAnthropicRequest({ text: event.message.message, system: userPrompt })

        const timer = await TGclient.db.getData('/configTg/timer')
        await sleep(getRndInteger(timer[0] * 1000, timer[1] * 1000))
        await TGclient.sendMessage(chatInput, { message: reply, replyTo: event.message.id})

        chatHistory.push({ user:  event.message });
        chatHistory.push({ assistant: reply });
        await TGclient.db.push(`/chats/${userId}`, chatHistory);
    } catch (error) {
        console.error('Ошибка:', error.message);
    }
};

const handleChat = async (event, chatInput, chatId, userId) => {
    const message = event.message.message;

    if (message === '/id') return getId(chatInput, event.message.id, chatId);

    try {
        const configTg = await TGclient.db.getData(`/configTg`);
        const savedChats = await TGclient.db.getData(`/savedChats`);
        if (!savedChats.includes(chatId)) {
            await TGclient.db.push(`/savedChats[]`, chatId);
            await TGclient.db.push(`/chats/${chatId}`, { main: [] });
        }

        const chatHistory = await TGclient.db.getData(`/chats/${chatId}`);
        if (chatHistory.main.length >= configTg.chatGlobal) chatHistory.main.shift();

        const me = await TGclient.getMe();
        if (me.id.valueOf() === userId.valueOf()) {
            console.log(`[bot] Распознана команда: ${message}`)
            if (message.startsWith('/deep')) return setDeep(chatInput, message);
            if (message.startsWith('/prompt')) return setPrompt(chatInput, message, event.message.media);
            if (message.startsWith('/system')) return setSystem(chatInput, message, event.message.media);
            if (message.startsWith('/start')) return changeStatus(chatInput, true);
            if (message.startsWith('/stop')) return changeStatus(chatInput, false);
            if (message.startsWith('/time')) return setTime(chatInput, message);
            return;
        }

        if (!WORKING) return
        chatHistory.main.push({ [userId]: message });

        const prompts = await TGclient.db.getData('/configTg/prompts')

        if (!prompts[chatId]) return
        chatPrompt = prompts[chatId]
        systemPrompt = prompts.system
        const reply = await shouldReply(message, chatHistory.main, chatHistory[userId], chatPrompt, systemPrompt);
        console.log(reply)
        if (reply.isReply) {
            chatHistory.main.push({ assistant: reply.text });
            chatHistory[userId] = chatHistory[userId] || [];
            if (chatHistory[userId].length >= configTg.chatUser) chatHistory[userId].shift();
            chatHistory[userId].push({ user: message, assistant: reply.text });

            const timer = await TGclient.db.getData('/configTg/timer')
            await sleep(getRndInteger(timer[0] * 1000, timer[1] * 1000))
            await TGclient.sendMessage(chatInput, { message: reply.text, replyTo: event.message.id})
        }

        await TGclient.db.push(`/chats/${chatId}`, chatHistory);
    } catch (error) {
        console.error('Ошибка:', error.message);
    }
};
let showed = false
const handleMessage = async (event) => {
    
    
    const chatInput = await event.getInputChat();
    const userId = chatInput.userId;
    const chatId = chatInput.chatId || chatInput.channelId
    // if (!showed) {
    //     console.log(chatInput)
    //     // showed = true
    // }

    if (userId) {
        await handleUser(event, chatInput, `${userId}`);
        // console.log(`[user] Получено сообщение: ${event.message.message}`);
    } else if (chatId && event.message.fromId) {
        await handleChat(event, chatInput, `${chatId}`, event.message.fromId.userId);
        // console.log(`[chat] Получено сообщение: ${event.message.message}`);
    }
};

TGclient.addEventHandler(handleMessage, new NewMessage({}));

(async () => {
    console.log("Начинаю процесс входа...");

    await TGclient.start({
        phoneNumber: async () => new Promise((resolve) => rl.question("Введите номер телефона: ", resolve)),
        password: async () => new Promise((resolve) => rl.question("Введите пароль: ", resolve)),
        phoneCode: async () => new Promise((resolve) => rl.question("Введите полученный код: ", resolve)),
        onError: console.log,
    });

    updateSessionString(TGclient.session.save());
    await sendMessage("me", "[bot] запущен");
    console.log("Успешный вход.");
})();
