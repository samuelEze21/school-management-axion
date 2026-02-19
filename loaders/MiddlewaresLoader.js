const path = require('path');
const { loadFiles } = require('./_common/fileLoader');

/**
 * MiddlewaresLoader - loads mws from mws/ folder. Each file exports a factory (injectable) => (req, res, next) =>.
 */
module.exports = class MiddlewaresLoader {
    constructor(injectable = {}) {
        this.injectable = injectable;
    }

    load() {
        const mwsDir = path.join(__dirname, '../mws');
        return loadFiles(mwsDir, { prefix: '__', suffix: '.mw.js' });
    }
};
