const { nanoid } = require('nanoid');

/**
 * Classroom manager handles CRUD for classrooms and student listing.
 */
module.exports = class Classroom {
    constructor({ utils, cache, config, cortex, managers, validators, oyster } = {}) {
        this.utils = utils;
        this.cache = cache;
        this.config = config;
        this.cortex = cortex;
        this.managers = managers;
        this.validators = validators;
        this.oyster = oyster;

        this.httpExposed = [
            'post=createClassroom',
            'get=listClassrooms',
            'get=getClassroom',
            'put=updateClassroom',
            'delete=deleteClassroom',
            'get=getClassroomStudents',
        ];
    }

    _canAccess(tokenData, schoolId) {
        if (!tokenData) return false;
        if (tokenData.role === 'superadmin') return true;
        return tokenData.schoolId && tokenData.schoolId === schoolId;
    }

    async createClassroom({ __longToken, __isSchoolAdmin, name, schoolId, capacity, grade, resources }) {
        try {
            if (!name || !schoolId) {
                return { error: 'missing required fields' };
            }

            if (!this._canAccess(__longToken, schoolId)) {
                return { error: 'forbidden: cannot access school' };
            }

            const school = await this.oyster.call('get_block', `school:${schoolId}`);
            if (!school) return { error: 'school not found' };

            const existing = await this.oyster.call('search_find', {
                label: 'classroom',
                query: { name, schoolId },
                fields: ['_id', 'name', 'schoolId'],
                limit: 1,
                offset: 0,
            });
            if (existing && existing.items && existing.items.length > 0) {
                return { error: 'classroom name already exists in school' };
            }

            const classroomId = nanoid();
            const now = new Date().toISOString();

            await this.oyster.call('add_block', {
                _label: 'classroom',
                _id: classroomId,
                _hosts: [`school:${schoolId}`],
                name,
                schoolId,
                capacity: typeof capacity === 'number' ? capacity : null,
                grade: grade || null,
                resources: Array.isArray(resources) ? resources : [],
                createdAt: now,
                updatedAt: now,
            });

            return {
                classroom: {
                    _id: classroomId,
                    name,
                    schoolId,
                    capacity: typeof capacity === 'number' ? capacity : null,
                    grade: grade || null,
                    resources: Array.isArray(resources) ? resources : [],
                    createdAt: now,
                    updatedAt: now,
                },
            };
        } catch (err) {
            console.log('createClassroom failed', err);
            return { error: 'create classroom failed' };
        }
    }

    async listClassrooms({ __longToken, page, limit, schoolId }) {
        try {
            page = parseInt(page || 1, 10);
            limit = parseInt(limit || 20, 10);
            const offset = (page - 1) * limit;

            let effectiveSchoolId = schoolId;
            if (__longToken && __longToken.role === 'schooladmin') {
                effectiveSchoolId = __longToken.schoolId;
            }

            const query = {};
            if (effectiveSchoolId) {
                query.schoolId = effectiveSchoolId;
            }

            const res = await this.oyster.call('search_find', {
                label: 'classroom',
                query,
                fields: ['_id', 'name', 'schoolId', 'capacity', 'grade', 'resources', 'createdAt', 'updatedAt'],
                limit,
                offset,
            });

            const classrooms = res && res.items ? res.items : [];

            return {
                classrooms,
                total: res && typeof res.total === 'number' ? res.total : classrooms.length,
                page,
                limit,
            };
        } catch (err) {
            console.log('listClassrooms failed', err);
            return { error: 'list classrooms failed' };
        }
    }

    async getClassroom({ __longToken, classroomId }) {
        try {
            if (!classroomId) return { error: 'classroomId is required' };

            const classroom = await this.oyster.call('get_block', `classroom:${classroomId}`);
            if (!classroom) return { error: 'classroom not found' };

            if (!this._canAccess(__longToken, classroom.schoolId)) {
                return { error: 'forbidden: cannot access classroom' };
            }

            return classroom;
        } catch (err) {
            console.log('getClassroom failed', err);
            return { error: 'get classroom failed' };
        }
    }

    async updateClassroom({ __longToken, __isSchoolAdmin, classroomId, name, capacity, grade, resources }) {
        try {
            if (!classroomId) return { error: 'classroomId is required' };

            const existing = await this.oyster.call('get_block', `classroom:${classroomId}`);
            if (!existing) return { error: 'classroom not found' };

            if (!this._canAccess(__longToken, existing.schoolId)) {
                return { error: 'forbidden: cannot access classroom' };
            }

            const update = {};
            if (typeof name !== 'undefined') update.name = name;
            if (typeof capacity !== 'undefined') update.capacity = capacity;
            if (typeof grade !== 'undefined') update.grade = grade;
            if (typeof resources !== 'undefined') update.resources = Array.isArray(resources) ? resources : [];
            update.updatedAt = new Date().toISOString();

            await this.oyster.call('update_block', {
                _id: `classroom:${classroomId}`,
                ...update,
            });

            return { ...existing, ...update };
        } catch (err) {
            console.log('updateClassroom failed', err);
            return { error: 'update classroom failed' };
        }
    }

    async deleteClassroom({ __longToken, __isSchoolAdmin, classroomId }) {
        try {
            if (!classroomId) return { error: 'classroomId is required' };

            const existing = await this.oyster.call('get_block', `classroom:${classroomId}`);
            if (!existing) return { error: 'classroom not found' };

            if (!this._canAccess(__longToken, existing.schoolId)) {
                return { error: 'forbidden: cannot access classroom' };
            }

            await this.oyster.call('delete_block', `classroom:${classroomId}`);

            return { message: 'classroom deleted' };
        } catch (err) {
            console.log('deleteClassroom failed', err);
            return { error: 'delete classroom failed' };
        }
    }

    async getClassroomStudents({ __longToken, classroomId, page, limit }) {
        try {
            if (!classroomId) return { error: 'classroomId is required' };

            const classroom = await this.oyster.call('get_block', `classroom:${classroomId}`);
            if (!classroom) return { error: 'classroom not found' };

            if (!this._canAccess(__longToken, classroom.schoolId)) {
                return { error: 'forbidden: cannot access classroom' };
            }

            page = parseInt(page || 1, 10);
            limit = parseInt(limit || 20, 10);
            const offset = (page - 1) * limit;

            const res = await this.oyster.call('search_find', {
                label: 'student',
                query: { classroomId },
                fields: ['_id', 'name', 'email', 'grade', 'schoolId', 'classroomId', 'createdAt'],
                limit,
                offset,
            });

            const students = res && res.items ? res.items : [];

            return {
                students,
                total: res && typeof res.total === 'number' ? res.total : students.length,
                classroom: { id: classroom._id, name: classroom.name },
            };
        } catch (err) {
            console.log('getClassroomStudents failed', err);
            return { error: 'get classroom students failed' };
        }
    }
};

