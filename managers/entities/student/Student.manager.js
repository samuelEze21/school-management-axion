const { nanoid } = require('nanoid');

/**
 * Student manager handles CRUD, listing, and transfers.
 */
module.exports = class Student {
    constructor({ utils, cache, config, cortex, managers, validators, oyster } = {}) {
        this.utils = utils;
        this.cache = cache;
        this.config = config;
        this.cortex = cortex;
        this.managers = managers;
        this.validators = validators;
        this.oyster = oyster;

        this.httpExposed = [
            'post=createStudent',
            'get=listStudents',
            'get=getStudent',
            'put=updateStudent',
            'delete=deleteStudent',
            'post=transferStudent',
            'get=getStudentHistory',
        ];
    }

    _canAccess(tokenData, schoolId) {
        if (!tokenData) return false;
        if (tokenData.role === 'superadmin') return true;
        return tokenData.schoolId && tokenData.schoolId === schoolId;
    }

    async _countStudentsInClassroom({ classroomId }) {
        const res = await this.oyster.call('search_find', {
            label: 'student',
            query: { classroomId },
            fields: ['_id'],
            limit: 1000,
            offset: 0,
        });
        if (!res || !res.items) return 0;
        return res.items.length;
    }

    async createStudent({
        __longToken,
        __isSchoolAdmin,
        name,
        email,
        phone,
        dateOfBirth,
        grade,
        address,
        schoolId,
        classroomId,
    }) {
        try {
            if (!name || !email || !schoolId) {
                return { error: 'missing required fields' };
            }

            if (!this._canAccess(__longToken, schoolId)) {
                return { error: 'forbidden: cannot access school' };
            }

            const school = await this.oyster.call('get_block', `school:${schoolId}`);
            if (!school) return { error: 'school not found' };

            let classroom = null;
            if (classroomId) {
                classroom = await this.oyster.call('get_block', `classroom:${classroomId}`);
                if (!classroom) return { error: 'classroom not found' };
                if (classroom.schoolId !== schoolId) {
                    return { error: 'classroom does not belong to school' };
                }

                if (classroom.capacity && classroom.capacity > 0) {
                    const count = await this._countStudentsInClassroom({ classroomId });
                    if (count >= classroom.capacity) {
                        return { error: 'classroom at full capacity' };
                    }
                }
            }

            const existing = await this.oyster.call('search_find', {
                label: 'student',
                query: { email },
                fields: ['_id', 'email'],
                limit: 1,
                offset: 0,
            });
            if (existing && existing.items && existing.items.length > 0) {
                return { error: 'student email already exists' };
            }

            const studentId = nanoid();
            const now = new Date().toISOString();
            const hosts = [`school:${schoolId}`];
            if (classroomId) hosts.push(`classroom:${classroomId}`);

            await this.oyster.call('add_block', {
                _label: 'student',
                _id: studentId,
                _hosts: hosts,
                name,
                email,
                phone: phone || null,
                dateOfBirth: dateOfBirth || null,
                grade: grade || null,
                address: address || null,
                schoolId,
                classroomId: classroomId || null,
                enrolledAt: now,
                transferHistory: [],
                createdAt: now,
                updatedAt: now,
            });

            return {
                student: {
                    _id: studentId,
                    name,
                    email,
                    phone: phone || null,
                    dateOfBirth: dateOfBirth || null,
                    grade: grade || null,
                    address: address || null,
                    schoolId,
                    classroomId: classroomId || null,
                    enrolledAt: now,
                    transferHistory: [],
                    createdAt: now,
                    updatedAt: now,
                },
            };
        } catch (err) {
            console.log('createStudent failed', err);
            return { error: 'create student failed' };
        }
    }

    async listStudents({ __longToken, page, limit, schoolId, classroomId, grade }) {
        try {
            page = parseInt(page || 1, 10);
            limit = parseInt(limit || 20, 10);
            const offset = (page - 1) * limit;

            let effectiveSchoolId = schoolId;
            if (__longToken && __longToken.role === 'schooladmin') {
                effectiveSchoolId = __longToken.schoolId;
            }

            const query = {};
            if (effectiveSchoolId) query.schoolId = effectiveSchoolId;
            if (classroomId) query.classroomId = classroomId;
            if (grade) query.grade = grade;

            const res = await this.oyster.call('search_find', {
                label: 'student',
                query,
                fields: ['_id', 'name', 'email', 'phone', 'grade', 'schoolId', 'classroomId', 'createdAt'],
                limit,
                offset,
            });

            const students = res && res.items ? res.items : [];

            return {
                students,
                total: res && typeof res.total === 'number' ? res.total : students.length,
                page,
                limit,
            };
        } catch (err) {
            console.log('listStudents failed', err);
            return { error: 'list students failed' };
        }
    }

    async getStudent({ __longToken, studentId }) {
        try {
            if (!studentId) return { error: 'studentId is required' };

            const student = await this.oyster.call('get_block', `student:${studentId}`);
            if (!student) return { error: 'student not found' };

            if (!this._canAccess(__longToken, student.schoolId)) {
                return { error: 'forbidden: cannot access student' };
            }

            return student;
        } catch (err) {
            console.log('getStudent failed', err);
            return { error: 'get student failed' };
        }
    }

    async updateStudent({
        __longToken,
        __isSchoolAdmin,
        studentId,
        name,
        email,
        phone,
        dateOfBirth,
        grade,
        address,
        classroomId,
    }) {
        try {
            if (!studentId) return { error: 'studentId is required' };

            const existing = await this.oyster.call('get_block', `student:${studentId}`);
            if (!existing) return { error: 'student not found' };

            if (!this._canAccess(__longToken, existing.schoolId)) {
                return { error: 'forbidden: cannot access student' };
            }

            let newClassroomId = existing.classroomId;
            if (typeof classroomId !== 'undefined') {
                newClassroomId = classroomId;
                if (newClassroomId) {
                    const classroom = await this.oyster.call('get_block', `classroom:${newClassroomId}`);
                    if (!classroom) return { error: 'classroom not found' };
                    if (classroom.schoolId !== existing.schoolId) {
                        return { error: 'classroom does not belong to student school' };
                    }
                }
            }

            const update = {};
            if (typeof name !== 'undefined') update.name = name;
            if (typeof email !== 'undefined') update.email = email;
            if (typeof phone !== 'undefined') update.phone = phone;
            if (typeof dateOfBirth !== 'undefined') update.dateOfBirth = dateOfBirth;
            if (typeof grade !== 'undefined') update.grade = grade;
            if (typeof address !== 'undefined') update.address = address;
            if (typeof classroomId !== 'undefined') update.classroomId = newClassroomId || null;
            update.updatedAt = new Date().toISOString();

            await this.oyster.call('update_block', {
                _id: `student:${studentId}`,
                ...update,
            });

            return { ...existing, ...update };
        } catch (err) {
            console.log('updateStudent failed', err);
            return { error: 'update student failed' };
        }
    }

    async deleteStudent({ __longToken, __isSchoolAdmin, studentId }) {
        try {
            if (!studentId) return { error: 'studentId is required' };

            const existing = await this.oyster.call('get_block', `student:${studentId}`);
            if (!existing) return { error: 'student not found' };

            if (!this._canAccess(__longToken, existing.schoolId)) {
                return { error: 'forbidden: cannot access student' };
            }

            await this.oyster.call('delete_block', `student:${studentId}`);

            return { message: 'student deleted' };
        } catch (err) {
            console.log('deleteStudent failed', err);
            return { error: 'delete student failed' };
        }
    }

    async transferStudent({ __longToken, __isSchoolAdmin, studentId, toSchoolId, toClassroomId, reason }) {
        try {
            if (!studentId || !toSchoolId) {
                return { error: 'missing required fields' };
            }

            const student = await this.oyster.call('get_block', `student:${studentId}`);
            if (!student) return { error: 'student not found' };

            if (!this._canAccess(__longToken, student.schoolId)) {
                return { error: 'forbidden: cannot transfer from this school' };
            }

            const toSchool = await this.oyster.call('get_block', `school:${toSchoolId}`);
            if (!toSchool) return { error: 'destination school not found' };

            let toClassroom = null;
            if (toClassroomId) {
                toClassroom = await this.oyster.call('get_block', `classroom:${toClassroomId}`);
                if (!toClassroom) return { error: 'destination classroom not found' };
                if (toClassroom.schoolId !== toSchoolId) {
                    return { error: 'destination classroom does not belong to destination school' };
                }
            }

            const transferRecord = {
                fromSchoolId: student.schoolId,
                fromClassroomId: student.classroomId || null,
                toSchoolId,
                toClassroomId: toClassroomId || null,
                reason: reason || null,
                transferredAt: new Date().toISOString(),
                transferredBy: __longToken.userId,
            };

            const history = Array.isArray(student.transferHistory) ? student.transferHistory.slice() : [];
            history.push(transferRecord);

            const hosts = [`school:${toSchoolId}`];
            if (toClassroomId) hosts.push(`classroom:${toClassroomId}`);

            const update = {
                schoolId: toSchoolId,
                classroomId: toClassroomId || null,
                _hosts: hosts,
                transferHistory: history,
                updatedAt: new Date().toISOString(),
            };

            await this.oyster.call('update_block', {
                _id: `student:${studentId}`,
                ...update,
            });

            const updatedStudent = { ...student, ...update };

            return {
                student: updatedStudent,
                transfer: transferRecord,
                message: 'student transferred',
            };
        } catch (err) {
            console.log('transferStudent failed', err);
            return { error: 'transfer student failed' };
        }
    }

    async getStudentHistory({ __longToken, studentId }) {
        try {
            if (!studentId) return { error: 'studentId is required' };

            const student = await this.oyster.call('get_block', `student:${studentId}`);
            if (!student) return { error: 'student not found' };

            if (!this._canAccess(__longToken, student.schoolId)) {
                return { error: 'forbidden: cannot access student' };
            }

            const history = Array.isArray(student.transferHistory) ? student.transferHistory : [];

            return {
                student: {
                    id: student._id,
                    name: student.name,
                    currentSchoolId: student.schoolId,
                },
                history,
            };
        } catch (err) {
            console.log('getStudentHistory failed', err);
            return { error: 'get student history failed' };
        }
    }
};

