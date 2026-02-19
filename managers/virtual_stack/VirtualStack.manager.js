const getParamNames = require('../api/_common/getParamNames');

/**
 * VirtualStack - runs preStack middlewares then param-based mws (__paramName from mwsRepo), then invokes the target method with merged params.
 */
module.exports = class VirtualStack {
    constructor({ preStack = [], mwsRepo = {}, managers, ...rest } = {}) {
        this.preStack = preStack;
        this.mwsRepo = mwsRepo;
        this.managers = managers;
        this.injectable = { managers, ...rest };
    }

    buildStack(methodFn) {
        const paramNames = getParamNames(methodFn);
        const pre = (this.preStack || []).map((name) => {
            const factory = this.mwsRepo[name];
            if (!factory) return null;
            return typeof factory === 'function' ? factory(this.injectable) : factory;
        }).filter(Boolean);

        const paramMws = paramNames
            .filter((p) => p.startsWith('__'))
            .map((name) => {
                const factory = this.mwsRepo[name];
                if (!factory) return null;
                return typeof factory === 'function' ? factory(this.injectable) : factory;
            })
            .filter(Boolean);

        return [...pre, ...paramMws];
    }

    run(methodFn, req, res, moduleInstance) {
        const paramNames = getParamNames(methodFn);
        const __params = paramNames.filter((p) => p.startsWith('__'));
        const stack = this.buildStack(methodFn);
        const values = [];
        let index = 0;

        const next = (value) => {
            values.push(value);
            const mw = stack[index++];
            if (!mw) {
                const params = { ...(req.query || {}), ...(req.body || {}) };
                __params.forEach((name, i) => { params[name] = values[i]; });
                return Promise.resolve()
                    .then(() => methodFn.call(moduleInstance, params))
                    .then((data) => {
                        if (data && data.error) return res.status(400).json({ ok: false, errors: data.error });
                        if (data && data.errors) return res.status(400).json({ ok: false, errors: data.errors });
                        return this.managers.responseDispatcher.dispatch(res, { ok: true, data: data || null });
                    })
                    .catch((e) => res.status(500).json({ ok: false, errors: e.message || String(e) }));
            }
            mw(req, res, next);
        };
        const first = stack[0];
        if (!first) {
            const params = { ...(req.query || {}), ...(req.body || {}) };
            return Promise.resolve()
                .then(() => methodFn.call(moduleInstance, params))
                .then((data) => this.managers.responseDispatcher.dispatch(res, { ok: true, data: data || null }))
                .catch((e) => res.status(500).json({ ok: false, errors: e.message || String(e) }));
        }
        first(req, res, next);
    }
};
