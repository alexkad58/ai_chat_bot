const sendMessage = require("../../utils/sendMessage");

module.exports = {
    name: 'testing',
    description: 'Устанавливает режим теста для чата.',
    execute: async (event, client, chatInput, args) => {
        if (!args[0]) return await sendMessage('[bot] Не приведен id чата.', chatInput, client, event.message.id);

        const target = isNaN(args[0]) ? await client.getEntity(args[0]) : { id: args[0] }
        testingChannelId = target.id
        
        if (client.cache.config.testChannel == testingChannelId) {
            client.cache.config.testChannel = ''
            await client.db.push('/config/testChannel', '')

            await sendMessage(`[bot] Режим теста **выключен** для \`${testingChannelId}\``, chatInput, client, event.message.id);
        } else {
            client.cache.config.testChannel = testingChannelId
            await client.db.push('/config/testChannel', testingChannelId)

            await sendMessage(`[bot] Режим теста **включен** для \`${testingChannelId}\``, chatInput, client, event.message.id);
        }
    },
};