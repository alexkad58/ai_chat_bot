const logger = async (message, client) => {
    if (client) client.sendMessage('me', { message })
    console.log(message)
}

module.exports = logger