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

const sendAnthropicRequest = async (prompt, chatId) => {
    try {
        const response = await axios.post(
            anthropicEndpoint,
            {
                model: model,
                max_tokens: 1024,
                system: prompt.system,
                messages: [
                    {
                        role: 'user',
                        content: prompt.text
                    }
                ]
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

        // console.log('Ответ от Anthropics:', response.data);
        return response.data.content[0].text
    } catch (error) {
        console.error('Ошибка при отправке запроса в Anthropics:', error.message);
    }
}

// const ai = new Anthropic({ apiKey: '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' });
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

const sendMessage = async (chatId, message) => {
    await TGclient.sendMessage(chatId, { message });
};

const setPrompt = async (chatInput, message) => {
    const args = message.split(' ');
    const configTg = await TGclient.db.getData('/configTg');

    const handlePromptError = async () => {
        await sendMessage(chatInput, 'Неправильное использование команды.\nИспользуйте: /prompt [g] [юзернейм | id_чата] <ваш_промпт>');
    };

    const updateConfig = async () => TGclient.db.push('/configTg', configTg);

    if (args[1] === 'g') {
        const prompt = args.slice(2).join(' ');
        if (!prompt) return handlePromptError();
        configTg.prompts.global = prompt;
    } else {
        const target = args[1];
        const prompt = args.slice(2).join(' ');
        if (!prompt) return handlePromptError();

        if (isNaN(target)) {
            try {
                const userEntity = await TGclient.getEntity(target);
                configTg.prompts[userEntity.id] = prompt;
            } catch (error) {
                console.log('Ошибка:', error.message);
            }
        } else {
            configTg.prompts[target] = prompt;
        }
    }

    await updateConfig();
    await sendMessage(chatInput, '[bot] промпт успешно установлен');
};

const setDeep = async (chatInput, message) => {
    const [_, chatGlobal, chatUser] = message.split(' ').map(Number);
    if (!chatGlobal || !chatUser) return;

    const configTg = await TGclient.db.getData('/configTg');
    configTg.chatGlobal = chatGlobal;
    configTg.chatUser = chatUser;
    await TGclient.db.push('/configTg', configTg);
    await sendMessage(chatInput, '[bot] значения успешно сохранены');
};

const getId = async (chatInput, messageId, chatId) => {
    await TGclient.deleteMessages(chatInput, [Number(messageId)], true);
    await sendMessage('me', `[bot] \`${chatId}\``);
};

const shouldReply = async (message, mainHistory, userHistory, chatPrompt) => {
    console.log(chatPrompt)
    const systemStart = 'Ты представляешь собой обычного пользователя, который общается в чатах непринуждённо и естественно. Твоя задача — читать сообщения и определять, нужно ли отвечать, чтобы поддерживать атмосферу живого общения. Ты должен вести себя как человек, отвечая только тогда, когда это уместно, а иногда просто наблюдая за беседой.'
    const systemShould = 'Для принятия решения учти: Актуальность и уместность: Отвечай, если сообщение содержит прямой вопрос, требует комментария, или если в беседе возникло обращение по твоему имени. Сохранение естественности: Старайся отвечать только на те сообщения, которые требуют участия, как это сделал бы обычный человек. Личный диалог: Обращай внимание на историю общения с автором. Если была начата личная беседа, можешь продолжить её, когда это кажется естественным, или если требуется уточнение.'
    const systemData = `Входные данные:
        Вот заданный промпт для данного чата: ${chatPrompt}} ты должен общаться полностью на основе этого промпта.
        Вот история последних сообщений: ${mainHistory}.
        Вот история общения с автором сообщения: ${userHistory}.
        Вот сообщение на которое ды должен ответить или не отвечать: ${message}.`
    const systemFinal = `Твоя задача: На основе этих данных прими решение, отвечать на сообщение или нет, и ответь ТОЛЬКО в формате JSON (без new line символа, чтобы можно было запарсить из строки в json):
        { "isReply": boolean, "text": string }
        Поле isReply: установи в true, если считаешь нужным ответить, и в false, если ответ не требуется.
        Поле text: заполни текстом ответа только если isReply равно true. В противном случае оставь text пустым.`

    const system = systemStart + systemShould + systemData + systemFinal
    const prompt = {}
    prompt.text = message
    prompt.system = system
    const reply = await sendAnthropicRequest(prompt)

    return JSON.parse(reply);
};

const handleUser = async (event, chatInput, userId) => {
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
        if (prompts[userId]) {
            userPrompt = prompts[userId]
        } else {
            userPrompt = prompts.global
        }
        const reply = await sendAnthropicRequest({ text: event.message.message, system: userPrompt })
        await sendMessage(chatInput, reply);
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
            if (message.startsWith('/deep')) return setDeep(chatInput, message);
            if (message.startsWith('/prompt')) return setPrompt(chatInput, message);
            return;
        }

        chatHistory.main.push({ [userId]: message });

        let chatPrompt = ''
        const prompts = await TGclient.db.getData('/configTg/prompts')
        if (prompts[chatId]) {
            chatPrompt = prompts[chatId]
        } else {
            chatPrompt = prompts.global
        }
        const reply = await shouldReply(message, chatHistory.main, chatHistory[userId], chatPrompt);
        console.log(reply)
        if (reply.isReply) {
            chatHistory.main.push({ assistant: reply.text });
            chatHistory[userId] = chatHistory[userId] || [];
            if (chatHistory[userId].length >= configTg.chatUser) chatHistory[userId].shift();
            chatHistory[userId].push({ user: message, assistant: reply.text });
            await sendMessage(chatInput, reply.text);
        }

        await TGclient.db.push(`/chats/${chatId}`, chatHistory);
    } catch (error) {
        console.error('Ошибка:', error.message);
    }
};

const handleMessage = async (event) => {
    const chatInput = await event.getInputChat();
    const userId = chatInput.userId;
    const chatId = chatInput.chatId;
    
    if (userId) {
        await handleUser(event, chatInput, `${userId}`);
        console.log(`[user] Получено сообщение: ${event.message.message}`);
    } else if (chatId) {
        await handleChat(event, chatInput, `${chatId}`, event.message.fromId.userId);
        console.log(`[chat] Получено сообщение: ${event.message.message}`);
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