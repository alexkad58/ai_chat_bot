const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'list',
    description: 'Выводит список всех чатов, у которых установлен промпт.',
    execute: async (event, client, chatInput) => {
        const list = []
        
        const ids = Object.keys(client.cache.config.prompts)
        if (!ids[0]) return await sendMessage(`[bot] Нет ни одного чата с промптом.`, chatInput, client);

        list.push('**Список чатов с установленным промптом**:')

        await client.getDialogs()
        for (id of ids) {
            const entity = await client.getEntity(id)

            const name = entity.title || entity.username || entity.firstName || entity.lastName
            const type = entity.title ? "чат" : "лс"
            list.push(`[${type}] [\`${id}\`] **${name}**`)
        }

        await sendMessage(list.join('\n'), chatInput, client);
    },
};