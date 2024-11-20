const sendMessage = async (message, chatInput, client, replyTo) => {
    await client.sendMessage(chatInput, { message, replyTo })
}

module.exports = sendMessage