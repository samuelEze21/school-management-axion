const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:5111';

function request({ method, path, body, token }) {
    const url = new URL(path, BASE_URL);

    const payload = body ? JSON.stringify(body) : null;

    const options = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + (url.search || ''),
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (token) {
        options.headers.token = token;
    }

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let json;
                try {
                    json = JSON.parse(data || '{}');
                } catch (e) {
                    json = {};
                }
                resolve({ status: res.statusCode, body: json });
            });
        });

        req.on('error', (err) => reject(err));

        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

const state = {};
const tests = [];

function addTest(name, fn) {
    tests.push({ name, fn });
}

function logResult(ok, name, message) {
    if (ok) {
        console.log(`✅ ${name}`);
    } else {
        console.log(`❌ ${name} - ${message || ''}`);
    }
}

addTest('1. GET /health → 200 ok:true', async () => {
    const res = await request({ method: 'GET', path: '/health' });
    const ok = res.status === 200 && res.body && res.body.ok === true;
    return { ok, message: `status=${res.status}, body.ok=${res.body.ok}` };
});

addTest('2. POST /api/user/login wrong credentials', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/user/login',
        body: { username: 'wrong', password: 'wrong' },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('3. POST /api/user/login missing fields', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/user/login',
        body: { username: 'only' },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('4. POST /api/user/login superadmin', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/user/login',
        body: {
            username: process.env.SUPERADMIN_USERNAME || 'superadmin',
            password: process.env.SUPERADMIN_PASSWORD || 'Admin@1234',
        },
    });
    const ok = res.body && res.body.ok === true && res.body.data && res.body.data.token;
    if (ok) {
        state.superToken = res.body.data.token;
        state.superUser = res.body.data.user;
    }
    return { ok, message: JSON.stringify(res.body) };
});

addTest('5. GET /api/user/getProfile no token', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/user/getProfile',
    });
    const ok = res.status === 401 || (res.body && res.body.ok === false);
    return { ok, message: JSON.stringify(res.body) };
});

addTest('6. GET /api/user/getProfile with superToken', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/user/getProfile',
        token: state.superToken,
    });
    const ok = res.body && res.body.ok === true && res.body.data && !res.body.data.password;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('7. POST /api/user/createUser no token', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/user/createUser',
        body: { username: 'x', password: '12345678', email: 'x@example.com', role: 'superadmin' },
    });
    const ok = res.status === 401 || (res.body && res.body.ok === false);
    return { ok, message: JSON.stringify(res.body) };
});

addTest('8. POST /api/user/createUser invalid role', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/user/createUser',
        token: state.superToken,
        body: { username: 'badrole', password: '12345678', email: 'bad@example.com', role: 'student' },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('9. POST /api/school/createSchool', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/school/createSchool',
        token: state.superToken,
        body: { name: 'School One', address: 'Addr 1', email: 'school1@example.com' },
    });
    const ok = res.body && res.body.ok === true && res.body.data && res.body.data.school;
    if (ok) {
        state.schoolId = res.body.data.school._id;
    }
    return { ok, message: JSON.stringify(res.body) };
});

addTest('10. POST /api/school/createSchool missing fields', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/school/createSchool',
        token: state.superToken,
        body: { name: 'Bad School' },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('11. GET /api/school/listSchools', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/school/listSchools',
        token: state.superToken,
    });
    const ok = res.body && res.body.ok === true && Array.isArray(res.body.data.schools);
    return { ok, message: JSON.stringify(res.body) };
});

addTest('12. GET /api/school/getSchool', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/school/getSchool',
        token: state.superToken,
        body: { schoolId: state.schoolId },
    });
    const ok = res.body && res.body.ok === true && res.body.data && res.body.data.name;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('13. GET /api/school/getSchool nonexistent', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/school/getSchool',
        token: state.superToken,
        body: { schoolId: 'nonexistent' },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('14. PUT /api/school/updateSchool', async () => {
    const res = await request({
        method: 'PUT',
        path: '/api/school/updateSchool',
        token: state.superToken,
        body: { schoolId: state.schoolId, phone: '123456789' },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('15. Create school2 for RBAC isolation tests', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/school/createSchool',
        token: state.superToken,
        body: { name: 'School Two', address: 'Addr 2', email: 'school2@example.com' },
    });
    const ok = res.body && res.body.ok === true && res.body.data && res.body.data.school;
    if (ok) {
        state.school2Id = res.body.data.school._id;
    }
    return { ok, message: JSON.stringify(res.body) };
});

addTest('16. POST /api/user/createUser schooladmin', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/user/createUser',
        token: state.superToken,
        body: {
            username: 'schooladmin1',
            password: 'Admin1234',
            name: 'School Admin 1',
            email: 'sa1@example.com',
            role: 'schooladmin',
            schoolId: state.schoolId,
        },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('17. POST /api/user/login as schooladmin', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/user/login',
        body: { username: 'schooladmin1', password: 'Admin1234' },
    });
    const ok = res.body && res.body.ok === true && res.body.data && res.body.data.token;
    if (ok) {
        state.adminToken = res.body.data.token;
    }
    return { ok, message: JSON.stringify(res.body) };
});

addTest('18. POST /api/classroom/createClassroom in own school', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/classroom/createClassroom',
        token: state.adminToken,
        body: { name: 'Class A', schoolId: state.schoolId },
    });
    const ok = res.body && res.body.ok === true && res.body.data && res.body.data.classroom;
    if (ok) {
        state.classroomId = res.body.data.classroom._id;
    }
    return { ok, message: JSON.stringify(res.body) };
});

addTest('19. POST /api/classroom/createClassroom in OTHER school', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/classroom/createClassroom',
        token: state.adminToken,
        body: { name: 'Class B', schoolId: state.school2Id },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('20. GET /api/classroom/listClassrooms as schooladmin', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/classroom/listClassrooms',
        token: state.adminToken,
    });
    const ok = res.body && res.body.ok === true && Array.isArray(res.body.data.classrooms);
    return { ok, message: JSON.stringify(res.body) };
});

addTest('21. GET /api/classroom/getClassroom', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/classroom/getClassroom',
        token: state.adminToken,
        body: { classroomId: state.classroomId },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('22. PUT /api/classroom/updateClassroom', async () => {
    const res = await request({
        method: 'PUT',
        path: '/api/classroom/updateClassroom',
        token: state.adminToken,
        body: { classroomId: state.classroomId, grade: '5', capacity: 2 },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('23. POST /api/student/createStudent in own school', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/student/createStudent',
        token: state.adminToken,
        body: {
            name: 'Student One',
            email: 'student1@example.com',
            schoolId: state.schoolId,
            classroomId: state.classroomId,
        },
    });
    const ok = res.body && res.body.ok === true && res.body.data && res.body.data.student;
    if (ok) {
        state.studentId = res.body.data.student._id;
    }
    return { ok, message: JSON.stringify(res.body) };
});

addTest('24. POST /api/student/createStudent in other school', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/student/createStudent',
        token: state.adminToken,
        body: {
            name: 'Student Two',
            email: 'student2@example.com',
            schoolId: state.school2Id,
        },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('25. GET /api/student/listStudents', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/student/listStudents',
        token: state.adminToken,
    });
    const ok = res.body && res.body.ok === true && Array.isArray(res.body.data.students);
    return { ok, message: JSON.stringify(res.body) };
});

addTest('26. GET /api/student/getStudent', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/student/getStudent',
        token: state.adminToken,
        body: { studentId: state.studentId },
    });
    const ok = res.body && res.body.ok === true && res.body.data && res.body.data.name === 'Student One';
    return { ok, message: JSON.stringify(res.body) };
});

addTest('27. PUT /api/student/updateStudent', async () => {
    const res = await request({
        method: 'PUT',
        path: '/api/student/updateStudent',
        token: state.adminToken,
        body: { studentId: state.studentId, phone: '999', grade: '6' },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('28. GET /api/classroom/getClassroomStudents', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/classroom/getClassroomStudents',
        token: state.adminToken,
        body: { classroomId: state.classroomId },
    });
    const ok = res.body && res.body.ok === true && Array.isArray(res.body.data.students);
    return { ok, message: JSON.stringify(res.body) };
});

addTest('29. POST /api/student/transferStudent', async () => {
    const res = await request({
        method: 'POST',
        path: '/api/student/transferStudent',
        token: state.superToken,
        body: { studentId: state.studentId, toSchoolId: state.school2Id, reason: 'Move' },
    });
    const ok =
        res.body &&
        res.body.ok === true &&
        res.body.data &&
        res.body.data.transfer &&
        res.body.data.student &&
        res.body.data.student.schoolId === state.school2Id;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('30. GET /api/student/getStudentHistory', async () => {
    const res = await request({
        method: 'GET',
        path: '/api/student/getStudentHistory',
        token: state.superToken,
        body: { studentId: state.studentId },
    });
    const ok =
        res.body &&
        res.body.ok === true &&
        res.body.data &&
        Array.isArray(res.body.data.history) &&
        res.body.data.history.length >= 1;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('31. PUT /api/user/changePassword wrong current', async () => {
    const res = await request({
        method: 'PUT',
        path: '/api/user/changePassword',
        token: state.superToken,
        body: { currentPassword: 'wrong', newPassword: 'NewPass123' },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('32. PUT /api/user/changePassword too short', async () => {
    const res = await request({
        method: 'PUT',
        path: '/api/user/changePassword',
        token: state.superToken,
        body: { currentPassword: process.env.SUPERADMIN_PASSWORD || 'Admin@1234', newPassword: 'short' },
    });
    const ok = res.body && res.body.ok === false;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('33. DELETE /api/student/deleteStudent', async () => {
    const res = await request({
        method: 'DELETE',
        path: '/api/student/deleteStudent',
        token: state.superToken,
        body: { studentId: state.studentId },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('34. DELETE /api/classroom/deleteClassroom', async () => {
    const res = await request({
        method: 'DELETE',
        path: '/api/classroom/deleteClassroom',
        token: state.superToken,
        body: { classroomId: state.classroomId },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('35. DELETE /api/school/deleteSchool (school1)', async () => {
    const res = await request({
        method: 'DELETE',
        path: '/api/school/deleteSchool',
        token: state.superToken,
        body: { schoolId: state.schoolId },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

addTest('36. DELETE /api/school/deleteSchool (school2)', async () => {
    const res = await request({
        method: 'DELETE',
        path: '/api/school/deleteSchool',
        token: state.superToken,
        body: { schoolId: state.school2Id },
    });
    const ok = res.body && res.body.ok === true;
    return { ok, message: JSON.stringify(res.body) };
});

(async () => {
    let failed = 0;
    for (const t of tests) {
        try {
            const res = await t.fn();
            logResult(res.ok, t.name, res.message);
            if (!res.ok) failed += 1;
        } catch (err) {
            logResult(false, t.name, err && err.message ? err.message : String(err));
            failed += 1;
        }
    }

    console.log('----------------------------------------');
    console.log(`Total: ${tests.length}, Passed: ${tests.length - failed}, Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
})();

