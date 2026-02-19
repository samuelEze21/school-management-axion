module.exports = ({ meta, config, managers }) => {
    return ({ req, res, results, next }) => {
        const tokenData = results['__longToken'];

        if (!tokenData || !['superadmin', 'schooladmin'].includes(tokenData.role)) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                errors: 'forbidden: schooladmin or superadmin access required',
            });
        }

        next(tokenData);
    };
};

