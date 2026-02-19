console.log('[STARTUP] index.js entered');
process.on('uncaughtException', (err) => {
    console.error('[STARTUP] Uncaught Exception:', err && err.message);
    if (err && err.stack) console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[STARTUP] Unhandled rejection:', reason);
    process.exit(1);
});

(function main() {
    try {
        console.log('[STARTUP] Loading config...');
        const config = require('./config/index.config.js');
        console.log('[STARTUP] Config OK, port=', config.dotEnv.USER_PORT);

        console.log('[STARTUP] Loading cache...');
        const cache = require('./cache/cache.dbh')({
            prefix: config.dotEnv.CACHE_PREFIX,
            url: config.dotEnv.CACHE_REDIS,
        });

        console.log('[STARTUP] Loading Oyster...');
        const Oyster = require('oyster-db');
        const oyster = new Oyster({
            url: config.dotEnv.OYSTER_REDIS,
            prefix: config.dotEnv.OYSTER_PREFIX,
        });

        console.log('[STARTUP] Loading Cortex...');
        const Cortex = require('ion-cortex');
        const cortex = new Cortex({
            prefix: config.dotEnv.CORTEX_PREFIX,
            url: config.dotEnv.CORTEX_REDIS,
            type: config.dotEnv.CORTEX_TYPE,
            state: () => ({}),
            activeDelay: '50',
            idlDelay: '200',
        });

        console.log('[STARTUP] Loading Aeon...');
        const Aeon = require('aeon-machine');
        const aeon = new Aeon({ cortex, timestampFrom: Date.now(), segmantDuration: 500 });

        console.log('[STARTUP] Loading managers...');
        const ManagersLoader = require('./loaders/ManagersLoader.js');
        const managersLoader = new ManagersLoader({ config, cache, cortex, oyster, aeon });
        const managers = managersLoader.load();

        if (managers.user && typeof managers.user.seedSuperAdmin === 'function') {
            setTimeout(() => managers.user.seedSuperAdmin(), 2000);
        }

        console.log('[STARTUP] Starting HTTP server...');
        managers.userServer.run();
        console.log('[STARTUP] Server run() called.');
    } catch (err) {
        console.error('[STARTUP] Failed:', err && err.message);
        if (err && err.stack) console.error(err.stack);
        process.exit(1);
    }
})();
