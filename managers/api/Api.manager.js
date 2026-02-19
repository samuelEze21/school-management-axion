const getParamNames = require('./_common/getParamNames');

/**
 * Api.manager - single route handler /api/:moduleName/:fnName. Dispatches to manager[moduleName][fnName] with mwsExec stack.
 */
module.exports = class ApiHandler {
    constructor({ managers, mwsExec, prop = 'httpExposed', ...rest } = {}) {
        this.managers = managers;
        this.mwsExec = mwsExec;
        this.prop = prop;
        this.injectable = { managers, ...rest };
    }

    mw = (req, res) => {
        const { moduleName, fnName } = req.params;
        const moduleInstance = this.managers[moduleName];
        if (!moduleInstance) {
            return res.status(404).json({ ok: false, errors: 'module not found' });
        }
        const exposed = moduleInstance[this.prop];
        if (!Array.isArray(exposed)) {
            return res.status(404).json({ ok: false, errors: 'module has no httpExposed' });
        }
        const spec = exposed.find((s) => {
            const [method, name] = s.split('=');
            return name === fnName && req.method.toLowerCase() === (method || 'get').toLowerCase();
        });
        if (!spec) {
            return res.status(404).json({ ok: false, errors: 'method not found' });
        }
        const [, name] = spec.split('=');
        const methodFn = typeof moduleInstance[name] === 'function' ? moduleInstance[name] : moduleInstance[fnName];
        if (typeof methodFn !== 'function') {
            return res.status(404).json({ ok: false, errors: 'handler not found' });
        }
        this.mwsExec.run(methodFn, req, res, moduleInstance);
    };
};
