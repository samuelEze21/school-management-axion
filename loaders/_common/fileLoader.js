const fs = require('fs');
const path = require('path');

/**
 * Load modules from a directory (e.g. mws/*.js). Optionally filter by prefix/suffix.
 */
function loadFiles(dir, options = {}) {
    const { prefix = '', suffix = '.js', basePath } = options;
    const base = basePath != null ? basePath : dir;
    const names = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(suffix));
    const out = {};
    for (const name of names) {
        const key = path.basename(name, suffix);
        const full = path.join(dir, name);
        try {
            out[key] = require(full);
        } catch (e) {
            console.warn('fileLoader: skip', full, e.message);
        }
    }
    return out;
}

module.exports = { loadFiles };
