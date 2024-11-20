const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'prompt',
    description: 'Устанавливает промпт.',
    execute: async (event, client, chatInput, args) => {
        if (!args[0]) return await sendMessage('[bot] Не приведен id чата или юзернейм', chatInput, client, event.message.id);
        if (!event.message.media) return await sendMessage('[bot] Не приведен .txt файл с промптом.', chatInput, client, event.message.id);

        const target = isNaN(args[0]) ? await client.getEntity(args[0]) : { id: args[0] }
        let promptText

        try {
            const promptBuffer = await client.downloadMedia(event.message.media, './promptTemp.txt');
            promptText = promptBuffer.toString('utf8')
        } catch (error) {
            await sendMessage('[bot] Не удалось прочитать .txt файл.', chatInput, client, event.message.id);
            console.error('Ошибка при загрузке файла:', error);
            return
        }

        client.cache.config.prompts[target.id] = promptText
        client.db.push(`/config`, client.cache.config)
        
        await sendMessage('[bot] Промпт успешно установлен.', chatInput, client, event.message.id);
    },
};