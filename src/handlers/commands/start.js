const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'start',
    description: 'Включает бота.',
    execute: async (event, client, chatInput) => {
        client.isWorking = true
        await sendMessage('[bot] Бот включен.', chatInput, client, event.message.id);
    },
};