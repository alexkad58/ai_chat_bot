require('dotenv').config();
const config = require('../config/config.json');
const updateConfig = require('./utils/updateConfig.js')
const initCache = require('./utils/initCache.js')
const handleCommand = require('./handlers/commandHandler');
const handleMessage = require('./handlers/messageHandler');
const { startApiSender, startCheckerCycle } = require('./utils/anthropicAPI.js');

const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require('telegram/events');
const { JsonDB, Config } = require('node-json-db');
// const { HttpsProxyAgent } = require('https-proxy-agent');
// const { randomUUID } = require('crypto');
// const fs = require('fs');
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const apiId = config.bot.appId;
const apiHash = config.bot.apiHash;
if (apiId === 0 || apiHash.length === 0) {
    console.log('Невозможно запустить бота: заполните config.json')
    process.exit()
}
const stringSession = new StringSession(config.bot.stringSession);
const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
const db = new JsonDB(new Config("db", true, true, '/'));
client.db = db;

(async () => {
    console.log("Начинаю процесс входа...");
    
    await client.start({
        phoneNumber: async () => new Promise((resolve) => rl.question("Введите номер телефона: ", resolve)),
        password: async () => new Promise((resolve) => rl.question("Введите пароль: ", resolve)),
        phoneCode: async () => new Promise((resolve) => rl.question("Введите полученный код: ", resolve)),
        onError: console.log,
    });

    config.bot.stringSession = client.session.save();
    updateConfig(config);
    await initCache(client);
    startApiSender(client);
    startCheckerCycle(client);

    console.log("Успешный вход.");
})();

client.addEventHandler(async (event) => {
    if (event.message.message.startsWith('/')) {
        await handleCommand(event, client);
    } else {
        await handleMessage(event, client);
    }
}, new NewMessage({}));