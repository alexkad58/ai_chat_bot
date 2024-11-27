const sendMessage = require("../../utils/sendMessage");
const logger = require("../utils/logger");

module.exports = {
    name: 'eval',
    description: 'Выполняет код.',
    execute: async (event, client, chatInput, args) => {
        if (!args[0]) return sendMessage('[bot] Напишите код для выполнения', chatInput, client, event.message.id);
        const code = args.join(' ')
        try {
            await eval(code)
            await sendMessage(`[bot] Код выполнен.`, chatInput, client, event.message.id);
        } catch (error) {
            await sendMessage(`[bot] Ошибка при выполнении кода: ${error.message}`, chatInput, client, event.message.id);
        }
    },
};
