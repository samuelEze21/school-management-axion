/**
 * ResponseDispatcher - standard JSON response for API.
 */
module.exports = class ResponseDispatcher {
    dispatch(res, { ok, code = 200, errors = null, data = null } = {}) {
        const status = code || (ok ? 200 : 500);
        res.status(status).json({ ok: !!ok, errors: errors || undefined, data: data || undefined });
    }
};
