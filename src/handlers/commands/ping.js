const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'ping',
    description: 'Отвечает "pong".',
    execute: async (event, client, chatInput) => {
        await sendMessage('[bot] pong', chatInput, client, event.message.id);
    },
};