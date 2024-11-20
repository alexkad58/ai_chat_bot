const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'deleteprompt',
    description: 'Удаляет промпт.',
    execute: async (event, client, chatInput, args) => {
        if (!args[0]) return await sendMessage('[bot] Не приведен id чата или юзернейм.', chatInput, client, event.message.id);

        const target = isNaN(args[0]) ? await client.getEntity(args[0]) : { id: args[0] }

        delete client.cache.config.prompts[target.id]
        client.db.delete(`/config/prompts/${target.id}`)
        
        await sendMessage('[bot] Промпт успешно удален.', chatInput, client, event.message.id);
    },
};