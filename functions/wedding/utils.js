const fs = require('fs');

exports.mkdirSync = function(dirPath) {
    try {
        return fs.mkdirSync(dirPath);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    return null;
};
