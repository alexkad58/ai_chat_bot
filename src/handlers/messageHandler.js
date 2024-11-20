const handleMessage = async (event, client) => {
    if (!client.isWorking) return;
    if (client.cache.me.id.valueOf() == event.message.fromId?.userId.valueOf()) return;

    const messageText = event.message.text;
    if (messageText.length < 1) return

    const chatId = event.message.peerId.chatId?.valueOf() || event.message.peerId.channelId?.valueOf()
    const userId = event.message.peerId.userId?.valueOf()
    if (chatId) {
        if (!client.cache.config.prompts[chatId]) return;
        
        const messageUnit = {
            role: 'user',
            content: messageText,
            user_id: event.message.fromId.userId,
            message_id: event.message.id,
            seen: false
        }
        if (!client.cache.history.chats[chatId]) {
            client.cache.history.chats[chatId] = []
        }
        client.cache.history.chats[chatId].push(messageUnit)

    } else if (userId) {
        if (!client.cache.config.prompts[userId]) return;

        const messageUnit = {
            role: 'user',
            content: messageText,
            user_id: userId,
            message_id: event.message.id,
            seen: false
        }

        if (!client.cache.history.chats[userId]) {
            client.cache.history.chats[userId] = []
        }

        client.cache.history.chats[userId].push(messageUnit)
    }
    
}

module.exports = handleMessage;