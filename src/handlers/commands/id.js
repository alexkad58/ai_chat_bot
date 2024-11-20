const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'id',
    description: 'Предоставляет id чата.',
    execute: async (event, client, chatInput) => {
        await client.deleteMessages(chatInput, [Number(event.message.id)], true);
        console.log(chatInput)
        const chatId = chatInput.chatId || chatInput.channelId
        if (!chatId) return await sendMessage(`[bot] Не удалось получить id чата`, 'me', client);
        await sendMessage(`[bot] Получен id чата: \`${chatId}\``, 'me', client);
    },
};