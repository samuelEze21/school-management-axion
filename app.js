const config         = require('./config/index.config.js');
const Cortex         = require('ion-cortex');
const ManagersLoader = require('./loaders/ManagersLoader.js');
const Oyster         = require('oyster-db');

const cache = require('./cache/cache.dbh')({
    prefix: config.dotEnv.CACHE_PREFIX,
    url: config.dotEnv.CACHE_REDIS,
});

const cortex = new Cortex({
    prefix: config.dotEnv.CORTEX_PREFIX,
    url: config.dotEnv.CORTEX_REDIS,
    type: config.dotEnv.CORTEX_TYPE,
    state: () => {
        return {};
    },
    activeDelay: '50ms',
    idlDelay: '200ms',
});

const oyster = new Oyster({
    prefix: config.dotEnv.OYSTER_PREFIX,
    url: config.dotEnv.OYSTER_REDIS,
});

const managersLoader = new ManagersLoader({ config, cache, cortex, oyster });
const managers = managersLoader.load();

if (managers.user && typeof managers.user.seedSuperAdmin === 'function') {
    setTimeout(() => {
        managers.user.seedSuperAdmin();
    }, 2000);
}

managers.userServer.run();
