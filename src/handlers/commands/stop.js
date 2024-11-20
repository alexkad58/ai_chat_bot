const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'stop',
    description: 'Выключает бота.',
    execute: async (event, client, chatInput) => {
        client.isWorking = false
        await sendMessage('[bot] Бот выключен.', chatInput, client, event.message.id);
    },
};