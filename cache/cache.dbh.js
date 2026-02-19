/**
 * Cache DBH - Redis-backed cache used by config/cortex. Returns a simple get/set/del interface.
 */
const Redis = require('ioredis');

module.exports = function createCache({ prefix = '', url = 'redis://127.0.0.1:6379' } = {}) {
    const client = new Redis(url, { maxRetriesPerRequest: 3 });
    const p = prefix ? `${prefix}:` : '';

    return {
        get: (key) => client.get(p + key).then((v) => (v != null ? JSON.parse(v) : null)),
        set: (key, val, ttlSeconds) => {
            const s = JSON.stringify(val);
            if (ttlSeconds) return client.setex(p + key, ttlSeconds, s);
            return client.set(p + key, s);
        },
        del: (key) => client.del(p + key),
        client,
    };
};
