const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const jwt = require('jsonwebtoken');

/**
 * User manager handles authentication, user CRUD, and profile management.
 */
module.exports = class User {
    /**
     * @param {object} deps
     * @param {object} deps.utils
     * @param {object} deps.cache
     * @param {object} deps.config
     * @param {object} deps.cortex
     * @param {object} deps.managers
     * @param {object} deps.validators
     * @param {object} deps.oyster
     */
    constructor({ utils, cache, config, cortex, managers, validators, oyster } = {}) {
        this.utils = utils;
        this.cache = cache;
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.managers = managers;
        this.oyster = oyster;

        this.httpExposed = [
            'post=login',
            'post=createUser',
            'get=listUsers',
            'get=getUser',
            'put=updateUser',
            'delete=deleteUser',
            'get=getProfile',
            'put=changePassword',
        ];
    }

    /**
     * Seed a default superadmin user if none exists.
     * Does not throw; logs errors and returns void.
     */
    async seedSuperAdmin() {
        try {
            const username = this.config.dotEnv.SUPERADMIN_USERNAME;
            const password = this.config.dotEnv.SUPERADMIN_PASSWORD;
            const email = this.config.dotEnv.SUPERADMIN_EMAIL;

            if (!username || !password || !email) {
                console.log('superadmin env vars not fully configured, skipping seed');
                return;
            }

            const searchRes = await this.oyster.call('search_find', {
                label: 'user',
                query: { username },
                fields: ['_id', 'username', 'role'],
                limit: 1,
                offset: 0,
            });

            if (searchRes && searchRes.total && searchRes.total > 0) {
                console.log('superadmin already exists, skipping seed');
                return;
            }

            const userId = nanoid();
            const hashed = await bcrypt.hash(password, 12);
            const now = new Date().toISOString();

            await this.oyster.call('add_block', {
                _label: 'user',
                _id: userId,
                username,
                password: hashed,
                name: 'Super Admin',
                email,
                role: 'superadmin',
                schoolId: null,
                createdAt: now,
                updatedAt: now,
            });

            console.log('Seeded superadmin user with credentials:');
            console.log(`  username: ${username}`);
            console.log(`  password: ${password}`);
            console.log(`  email:    ${email}`);
        } catch (err) {
            console.log('failed to seed superadmin', err && err.message ? err.message : err);
        }
    }

    /**
     * Authenticate a user and issue a long-lived JWT.
     * @param {object} params
     * @param {string} params.username
     * @param {string} params.password
     * @returns {Promise<object>}
     */
    async login({ username, password }) {
        try {
            const validationError = await this.validators.user.login({ username, password });
            if (validationError) {
                return { errors: validationError };
            }

            const searchRes = await this.oyster.call('search_find', {
                label: 'user',
                query: { username },
                fields: ['_id', 'username', 'password', 'name', 'email', 'role', 'schoolId'],
                limit: 1,
                offset: 0,
            });

            if (!searchRes || !searchRes.items || searchRes.items.length === 0) {
                return { error: 'invalid credentials' };
            }

            const user = searchRes.items[0];

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return { error: 'invalid credentials' };
            }

            const payload = {
                userId: user._id,
                role: user.role,
                schoolId: user.schoolId || null,
            };
            const token = jwt.sign(payload, this.config.dotEnv.LONG_TOKEN_SECRET, {
                expiresIn: '3y',
            });

            delete user.password;

            return { token, user };
        } catch (err) {
            console.log('login failed', err);
            return { error: 'login failed' };
        }
    }

    /**
     * Create a new user (superadmin only).
     * @param {object} params
     */
    async createUser({ __longToken, __isSuperAdmin, username, password, name, email, role, schoolId }) {
        try {
            if (!username || !password || !email || !role) {
                return { error: 'missing required fields' };
            }

            const validationError = await this.validators.user.createUser({
                username,
                password,
                email,
                role,
            });
            if (validationError) {
                return { errors: validationError };
            }

            if (!['superadmin', 'schooladmin'].includes(role)) {
                return { error: 'invalid role' };
            }

            if (role === 'schooladmin' && !schoolId) {
                return { error: 'schoolId is required for schooladmin' };
            }

            if (password.length < 8) {
                return { error: 'password too short' };
            }

            const existing = await this.oyster.call('search_find', {
                label: 'user',
                query: { username },
                fields: ['_id', 'username'],
                limit: 1,
                offset: 0,
            });
            if (existing && existing.items && existing.items.length > 0) {
                return { error: 'username already exists' };
            }

            const userId = nanoid();
            const hashed = await bcrypt.hash(password, 12);
            const now = new Date().toISOString();

            await this.oyster.call('add_block', {
                _label: 'user',
                _id: userId,
                username,
                password: hashed,
                name: name || username,
                email,
                role,
                schoolId: schoolId || null,
                createdAt: now,
                updatedAt: now,
            });

            const created = {
                _id: userId,
                username,
                name: name || username,
                email,
                role,
                schoolId: schoolId || null,
                createdAt: now,
                updatedAt: now,
            };

            return created;
        } catch (err) {
            console.log('createUser failed', err);
            return { error: 'create user failed' };
        }
    }

    /**
     * List users with optional role filter.
     */
    async listUsers({ __longToken, __isSuperAdmin, page, limit, role }) {
        try {
            page = parseInt(page || 1, 10);
            limit = parseInt(limit || 20, 10);
            const offset = (page - 1) * limit;

            const query = {};
            if (role) query.role = role;

            const res = await this.oyster.call('search_find', {
                label: 'user',
                query,
                fields: ['_id', 'username', 'name', 'email', 'role', 'schoolId', 'createdAt', 'updatedAt'],
                limit,
                offset,
            });

            const users = (res && res.items ? res.items : []).map((u) => {
                const copy = { ...u };
                delete copy.password;
                return copy;
            });

            return {
                users,
                total: res && typeof res.total === 'number' ? res.total : users.length,
                page,
                limit,
            };
        } catch (err) {
            console.log('listUsers failed', err);
            return { error: 'list users failed' };
        }
    }

    /**
     * Get a single user by id.
     */
    async getUser({ __longToken, __isSuperAdmin, userId }) {
        try {
            if (!userId) return { error: 'userId is required' };

            const user = await this.oyster.call('get_block', `user:${userId}`);
            if (!user) return { error: 'user not found' };

            delete user.password;
            return user;
        } catch (err) {
            console.log('getUser failed', err);
            return { error: 'get user failed' };
        }
    }

    /**
     * Update user fields.
     */
    async updateUser({ __longToken, __isSuperAdmin, userId, name, email, role, schoolId }) {
        try {
            if (!userId) return { error: 'userId is required' };

            const existing = await this.oyster.call('get_block', `user:${userId}`);
            if (!existing) return { error: 'user not found' };

            const update = {};
            if (typeof name !== 'undefined') update.name = name;
            if (typeof email !== 'undefined') update.email = email;
            if (typeof role !== 'undefined') {
                if (!['superadmin', 'schooladmin'].includes(role)) {
                    return { error: 'invalid role' };
                }
                update.role = role;
            }
            if (typeof schoolId !== 'undefined') update.schoolId = schoolId;

            update.updatedAt = new Date().toISOString();

            await this.oyster.call('update_block', {
                _id: `user:${userId}`,
                ...update,
            });

            const updated = { ...existing, ...update };
            delete updated.password;

            return updated;
        } catch (err) {
            console.log('updateUser failed', err);
            return { error: 'update user failed' };
        }
    }

    /**
     * Delete a user.
     */
    async deleteUser({ __longToken, __isSuperAdmin, userId }) {
        try {
            if (!userId) return { error: 'userId is required' };

            const existing = await this.oyster.call('get_block', `user:${userId}`);
            if (!existing) return { error: 'user not found' };

            await this.oyster.call('delete_block', `user:${userId}`);

            return { message: 'user deleted' };
        } catch (err) {
            console.log('deleteUser failed', err);
            return { error: 'delete user failed' };
        }
    }

    /**
     * Get the profile of the currently authenticated user.
     */
    async getProfile({ __longToken }) {
        try {
            if (!__longToken || !__longToken.userId) {
                return { error: 'unauthorized' };
            }

            const user = await this.oyster.call('get_block', `user:${__longToken.userId}`);
            if (!user) return { error: 'user not found' };

            delete user.password;
            return user;
        } catch (err) {
            console.log('getProfile failed', err);
            return { error: 'get profile failed' };
        }
    }

    /**
     * Change password of the authenticated user.
     */
    async changePassword({ __longToken, currentPassword, newPassword }) {
        try {
            if (!__longToken || !__longToken.userId) {
                return { error: 'unauthorized' };
            }

            if (!currentPassword || !newPassword) {
                return { error: 'missing required fields' };
            }

            if (newPassword.length < 8) {
                return { error: 'password too short' };
            }

            const user = await this.oyster.call('get_block', `user:${__longToken.userId}`);
            if (!user) return { error: 'user not found' };

            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) {
                return { error: 'invalid current password' };
            }

            const hashed = await bcrypt.hash(newPassword, 12);
            const updatedAt = new Date().toISOString();

            await this.oyster.call('update_block', {
                _id: `user:${__longToken.userId}`,
                password: hashed,
                updatedAt,
            });

            return { message: 'password changed' };
        } catch (err) {
            console.log('changePassword failed', err);
            return { error: 'change password failed' };
        }
    }
};
