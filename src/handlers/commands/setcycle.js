const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'setcycle',
    description: 'Устанавливает время циклов.',
    execute: async (event, client, chatInput, args) => {
        if (!args[0]) return await sendMessage('[bot] Не приведен размер цикла в секундах.', chatInput, client, event.message.id);

        const seconds = args[0]
        const ms = seconds * 1000
        client.cache.config.cycleTimer = ms
        await client.db.push('/config/cycleTimer', ms)
        await sendMessage(`[bot] Установил время цикла (${seconds} секунд)`, chatInput, client, event.message.id);      
    },
};