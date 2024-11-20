const { Api } = require("telegram");

const generateRequestOptions = async (history, chatId, client) => {
    const options = {}
    const usersInfo = {}
    const usersIds = []
    
    const parsedHistory = []
    await client.getDialogs()
    for (const index in history) {
        const messageUnit = history[index]

        if (messageUnit.role == 'assistant') {
            parsedHistory.push(messageUnit)
            continue
        }
        parsedHistory.push({
            role: messageUnit.role,
            content: `[user_id:${messageUnit.user_id}|message_id:${messageUnit.message_id}|seen:${messageUnit.seen}] ${messageUnit.content}`
        })

        if (usersInfo[messageUnit.user_id]) continue
        usersIds.push(messageUnit.user_id)

        try {
            const user = await client.invoke(
                new Api.users.GetFullUser({
                  id: messageUnit.user_id,
                })
            );
            usersInfo[messageUnit.user_id] = {
                username: user.users[0].username,
                firstName: user.users[0].firstName,
                lastName: user.users[0].lastName,
                bio: user.fullUser.about
            }
        } catch (error) {
            console.log(error.message)
        }
    }

    const chatPrompt = client.cache.config.prompts[chatId]

    options.history = parsedHistory
    options.chatId = chatId
    options.usersInfo = usersInfo
    options.chatPrompt = chatPrompt

    options.usersIds = usersIds
    
    return options
}

module.exports = generateRequestOptions