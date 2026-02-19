module.exports = ({ meta, config, managers }) => {
    return ({ req, res, results, next }) => {
        const tokenData = results['__longToken'];

        if (!tokenData || tokenData.role !== 'superadmin') {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                errors: 'forbidden: superadmin access required',
            });
        }

        next(tokenData);
    };
};

