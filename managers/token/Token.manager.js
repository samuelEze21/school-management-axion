const jwt = require('jsonwebtoken');

/**
 * Token manager - issue and verify long/short tokens.
 */
module.exports = class TokenManager {
    constructor({ config, managers } = {}) {
        this.config = config;
        this.managers = managers;
        this.longSecret = (this.config && this.config.dotEnv && this.config.dotEnv.LONG_TOKEN_SECRET) || process.env.LONG_TOKEN_SECRET;
        this.shortSecret = (this.config && this.config.dotEnv && this.config.dotEnv.SHORT_TOKEN_SECRET) || process.env.SHORT_TOKEN_SECRET;
    }

    verifyLongToken({ token } = {}) {
        if (!token || !this.longSecret) return null;
        try {
            return jwt.verify(token, this.longSecret);
        } catch (e) {
            return null;
        }
    }

    verifyShortToken({ token } = {}) {
        if (!token || !this.shortSecret) return null;
        try {
            return jwt.verify(token, this.shortSecret);
        } catch (e) {
            return null;
        }
    }

    signLongToken(payload, options = {}) {
        if (!this.longSecret) throw new Error('LONG_TOKEN_SECRET not set');
        return jwt.sign(payload, this.longSecret, { expiresIn: options.expiresIn || '7d', ...options });
    }

    signShortToken(payload, options = {}) {
        if (!this.shortSecret) throw new Error('SHORT_TOKEN_SECRET not set');
        return jwt.sign(payload, this.shortSecret, { expiresIn: options.expiresIn || '15m', ...options });
    }
};
