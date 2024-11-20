const fs = require('fs');
const path = require('path');
const { sendMessage } = require('../utils/helpers')
const logger = require('../utils/logger')

const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');

fs.readdirSync(commandsPath).forEach((file) => {
    if (file.endsWith('.js')) {
        const command = require(path.join(commandsPath, file));
        commands.set(command.name, command);
    }
});

async function handleCommand(event, client, userId) {
    const messageText = event.message.message || '';
    if (!messageText.startsWith('/')) return;
    if (client.cache.me.id.valueOf() != event.message.fromId.userId.valueOf()) return;

    const chatInput = await event.getInputChat();
    const [commandName, ...args] = messageText.slice(1).split(' ');
    const command = commands.get(commandName);

    

    if (!command) {
        await sendMessage(`[bot] Неизвестная команда: /${commandName}`, chatInput, client, event.message.id);
        return;
    }

    try {
        await command.execute(event, client, chatInput, args);
    } catch (error) {
        logger(`[бот] Ошибка выполнения команды /${commandName}: ${error.message}`, client)
        await sendMessage(`[bot] Произошла ошибка при выполнении команды.`, chatInput, client, event.message.id);
    }
}

module.exports = handleCommand;
