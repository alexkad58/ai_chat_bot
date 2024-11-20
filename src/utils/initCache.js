const logger = require("./logger")

const updateCache = async (client) => {
    client.isWorking = true 

    client.cache = {}
    client.cache.me = await client.getMe()
    client.cache.config = await client.db.getData('/config')
    client.cache.history = {}
    client.cache.history.chats = {}
    client.cache.history.users = {}
    client.cache.requestsToSend = []
    client.cache.requestsToCheck = []

    logger(`[бот] Кэш инициализирован.`, client)
}

module.exports = updateCache