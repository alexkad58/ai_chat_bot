const fs = require('fs');
const logger = require('./logger');

const updateConfig = (updatedConfig) => {
    fs.writeFile('./config/config.json', JSON.stringify(updatedConfig), 'utf8', (err) => {
        if (err) throw err;
        logger(`[бот] Конфиг обновлен.`)
    });
}
module.exports = updateConfig