const { nanoid } = require('nanoid');

/**
 * School manager handles CRUD for schools.
 */
module.exports = class School {
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
        this.managers = managers;
        this.validators = validators;
        this.oyster = oyster;

        this.httpExposed = [
            'post=createSchool',
            'get=listSchools',
            'get=getSchool',
            'put=updateSchool',
            'delete=deleteSchool',
        ];
    }

    /**
     * Create a new school (superadmin only).
     */
    async createSchool({ __longToken, __isSuperAdmin, name, address, email, phone, principalName, capacity }) {
        try {
            if (!name || !address || !email) {
                return { error: 'missing required fields' };
            }

            const validationError = await this.validators.school.createSchool({ name, address, email });
            if (validationError) return validationError;

            const existing = await this.oyster.call('search_find', {
                label: 'school',
                query: { name },
                fields: ['_id', 'name'],
                limit: 1,
                offset: 0,
            });
            if (existing && existing.items && existing.items.length > 0) {
                return { error: 'school name already exists' };
            }

            const schoolId = nanoid();
            const now = new Date().toISOString();

            await this.oyster.call('add_block', {
                _label: 'school',
                _id: schoolId,
                name,
                address,
                email,
                phone: phone || null,
                principalName: principalName || null,
                capacity: typeof capacity === 'number' ? capacity : null,
                createdAt: now,
                updatedAt: now,
            });

            return {
                school: {
                    _id: schoolId,
                    name,
                    address,
                    email,
                    phone: phone || null,
                    principalName: principalName || null,
                    capacity: typeof capacity === 'number' ? capacity : null,
                    createdAt: now,
                    updatedAt: now,
                },
            };
        } catch (err) {
            console.log('createSchool failed', err);
            return { error: 'create school failed' };
        }
    }

    /**
     * List schools with optional search term.
     */
    async listSchools({ __longToken, page, limit, search }) {
        try {
            page = parseInt(page || 1, 10);
            limit = parseInt(limit || 20, 10);
            const offset = (page - 1) * limit;

            const query = {};
            if (search) {
                query.name = search;
            }

            const res = await this.oyster.call('search_find', {
                label: 'school',
                query,
                fields: ['_id', 'name', 'address', 'email', 'phone', 'principalName', 'capacity', 'createdAt', 'updatedAt'],
                limit,
                offset,
            });

            const schools = res && res.items ? res.items : [];

            return {
                schools,
                total: res && typeof res.total === 'number' ? res.total : schools.length,
                page,
                limit,
            };
        } catch (err) {
            console.log('listSchools failed', err);
            return { error: 'list schools failed' };
        }
    }

    /**
     * Get a single school.
     */
    async getSchool({ __longToken, schoolId }) {
        try {
            if (!schoolId) return { error: 'schoolId is required' };

            const school = await this.oyster.call('get_block', `school:${schoolId}`);
            if (!school) return { error: 'school not found' };

            return school;
        } catch (err) {
            console.log('getSchool failed', err);
            return { error: 'get school failed' };
        }
    }

    /**
     * Update a school.
     */
    async updateSchool({ __longToken, __isSuperAdmin, schoolId, name, address, email, phone, principalName, capacity }) {
        try {
            if (!schoolId) return { error: 'schoolId is required' };

            const existing = await this.oyster.call('get_block', `school:${schoolId}`);
            if (!existing) return { error: 'school not found' };

            const update = {};
            if (typeof name !== 'undefined') update.name = name;
            if (typeof address !== 'undefined') update.address = address;
            if (typeof email !== 'undefined') update.email = email;
            if (typeof phone !== 'undefined') update.phone = phone;
            if (typeof principalName !== 'undefined') update.principalName = principalName;
            if (typeof capacity !== 'undefined') update.capacity = capacity;
            update.updatedAt = new Date().toISOString();

            await this.oyster.call('update_block', {
                _id: `school:${schoolId}`,
                ...update,
            });

            return { ...existing, ...update };
        } catch (err) {
            console.log('updateSchool failed', err);
            return { error: 'update school failed' };
        }
    }

    /**
     * Delete a school.
     */
    async deleteSchool({ __longToken, __isSuperAdmin, schoolId }) {
        try {
            if (!schoolId) return { error: 'schoolId is required' };

            const existing = await this.oyster.call('get_block', `school:${schoolId}`);
            if (!existing) return { error: 'school not found' };

            await this.oyster.call('delete_block', `school:${schoolId}`);

            return { message: 'school deleted' };
        } catch (err) {
            console.log('deleteSchool failed', err);
            return { error: 'delete school failed' };
        }
    }
};

