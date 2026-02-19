# School Management System API

## For evaluators — quick run

**Prerequisites:** Node.js (v16+), Redis on `localhost:6379`.

```bash
npm install
cp .env.example .env
npm start
```

In another terminal (API must be running):

```bash
npm test
```

**First login:** `POST /api/user/login` with the username and password you set in `.env` (see `.env.example` for variable names). Use header **`token: <jwt>`** for protected routes. Health: `GET /health`.

**Folder/zip submission:** The project includes a `.env` file with defaults for Redis at `127.0.0.1:6379`. When uploading the folder or a zip, include everything (with or without `node_modules`; evaluators can run `npm install`). See `SUBMISSION.md` for text to paste into the submission form description field.

---

## Project Overview

This project is a **School Management System API** implemented on top of the existing **Axion** backend template.  
All HTTP traffic flows through a single dynamic endpoint (`/api/:moduleName/:fnName`), with business logic organised into **manager** classes and **middleware-injected** parameters.  
The API provides authentication, RBAC, and CRUD operations for **users, schools, classrooms, and students**, backed by **OysterDB** (Redis-based document store).

## Tech Stack

| Technology    | Purpose                                   |
|--------------|-------------------------------------------|
| Node.js      | Runtime                                   |
| Express      | HTTP server                               |
| Redis        | In‑memory data store                      |
| OysterDB     | Redis‑backed document & relation store    |
| ion-cortex   | Event bus / virtual stack orchestration   |
| JWT          | Authentication tokens                     |
| bcrypt       | Password hashing                          |

## Quick Start

```bash
git clone https://github.com/qantra-io/axion.git
cd axion
npm install
cp .env.example .env
npm start
```

The API will start on the port defined by `USER_PORT` (default `5111`).

## Architecture

- **Single HTTP entrypoint**: All routes use `POST/GET/PUT/DELETE /api/:moduleName/:fnName`.
- **Managers**: Each entity (user, school, classroom, student) has a manager class under `managers/entities/*/*.manager.js` exposing methods via an `httpExposed` array.
- **Middleware injection**:
  - Any parameter starting with `__` in a manager method signature triggers a middleware with the same name (e.g. `__longToken` → `mws/__longToken.mw.js`).
  - Middleware results are injected into the method’s parameter object.
- **Routing**:
  - `managers/api/Api.manager.js` scans managers for `httpExposed`, builds a method matrix, and uses `VirtualStack` to run middlewares before invoking the target method.
- **Responses**:
  - Managers return **plain objects** (`{ error }` or data).
  - `ResponseDispatcher` maps manager output to HTTP responses; managers never call `res.json` directly.

## Environment Variables

Set these in your environment or `.env` (never commit real `.env`; use `.env.example` as a template). Use strong, unique values for all secrets in production.

| Variable             | Required | Description |
|----------------------|----------|-------------|
| SERVICE_NAME         | Yes      | Service name (for logs/health). |
| USER_PORT            | No       | HTTP server port (default `5111`). On Render, `PORT` is set automatically. |
| REDIS_URI            | Yes      | Redis connection URL (e.g. `redis://…` or `rediss://…` for TLS). |
| CORTEX_REDIS         | Yes      | Same Redis URL for ion-cortex. |
| CORTEX_PREFIX        | Yes      | Key prefix for cortex (e.g. `school`). |
| CORTEX_TYPE          | Yes      | Cortex type identifier (e.g. `school-management`). |
| OYSTER_REDIS         | Yes      | Same Redis URL for OysterDB. |
| OYSTER_PREFIX        | Yes      | OysterDB key prefix (e.g. `school`). |
| CACHE_REDIS          | Yes      | Same Redis URL for cache. |
| CACHE_PREFIX         | Yes      | Cache key prefix (e.g. `school:ch`). |
| LONG_TOKEN_SECRET    | Yes      | **Secret.** JWT signing key for long-lived tokens. Set a long random string. |
| SHORT_TOKEN_SECRET   | Yes      | **Secret.** JWT signing key for short-lived tokens. Set a long random string. |
| NACL_SECRET          | Yes      | **Secret.** Symmetric key used by template. Set a long random string. |
| SUPERADMIN_USERNAME  | Yes      | Username for the seeded superadmin (local/dev only; change in production). |
| SUPERADMIN_PASSWORD  | Yes      | **Secret.** Password for the seeded superadmin. Use a strong password in production. |
| SUPERADMIN_EMAIL     | Yes      | Email for the seeded superadmin. |

Copy `.env.example` to `.env` and fill in values locally; for production, set variables in your host’s dashboard and never commit secrets.

## First Login

- Credentials are set via `SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD` in your environment. The superadmin is seeded on first startup if none exists.
- **Auth header:** Use **`token: <jwt>`** on all protected endpoints (not `Authorization: Bearer`).
- Change the default password immediately in any non-local environment.

## Full API Reference

All methods use **JSON request bodies**; responses follow `{ ok, data, message, errors }`.

### User APIs

| Method | Path                     | Auth       | Body Fields                                                                 |
|--------|--------------------------|------------|-----------------------------------------------------------------------------|
| POST   | `/api/user/login`       | PUBLIC     | `username`, `password`                                                      |
| POST   | `/api/user/createUser`  | SUPERADMIN | `username`, `password`, `name`, `email`, `role` (`superadmin`/`schooladmin`), `schoolId?` |
| GET    | `/api/user/listUsers`   | SUPERADMIN | `page?`, `limit?`, `role?`                                                  |
| GET    | `/api/user/getUser`     | SUPERADMIN | `userId`                                                                    |
| PUT    | `/api/user/updateUser`  | SUPERADMIN | `userId`, `name?`, `email?`, `role?`, `schoolId?`                           |
| DELETE | `/api/user/deleteUser`  | SUPERADMIN | `userId`                                                                    |
| GET    | `/api/user/getProfile`  | AUTH       | *(no body, uses token)*                                                     |
| PUT    | `/api/user/changePassword` | AUTH    | `currentPassword`, `newPassword`                                            |

### School APIs

| Method | Path                        | Auth       | Body Fields                                                                 |
|--------|-----------------------------|------------|-----------------------------------------------------------------------------|
| POST   | `/api/school/createSchool`  | SUPERADMIN | `name`, `address`, `email`, `phone?`, `principalName?`, `capacity?`        |
| GET    | `/api/school/listSchools`   | AUTH       | `page?`, `limit?`, `search?`                                                |
| GET    | `/api/school/getSchool`     | AUTH       | `schoolId`                                                                  |
| PUT    | `/api/school/updateSchool`  | SUPERADMIN | `schoolId`, `name?`, `address?`, `email?`, `phone?`, `principalName?`, `capacity?` |
| DELETE | `/api/school/deleteSchool`  | SUPERADMIN | `schoolId`                                                                  |

### Classroom APIs

| Method | Path                             | Auth        | Body Fields                                                                 |
|--------|----------------------------------|-------------|-----------------------------------------------------------------------------|
| POST   | `/api/classroom/createClassroom` | SCHOOLADMIN | `name`, `schoolId`, `capacity?`, `grade?`, `resources?` (array)            |
| GET    | `/api/classroom/listClassrooms`  | AUTH        | `page?`, `limit?`, `schoolId?`                                             |
| GET    | `/api/classroom/getClassroom`    | AUTH        | `classroomId`                                                              |
| PUT    | `/api/classroom/updateClassroom` | SCHOOLADMIN | `classroomId`, `name?`, `capacity?`, `grade?`, `resources?`                |
| DELETE | `/api/classroom/deleteClassroom` | SCHOOLADMIN | `classroomId`                                                              |
| GET    | `/api/classroom/getClassroomStudents` | AUTH   | `classroomId`, `page?`, `limit?`                                           |

### Student APIs

| Method | Path                          | Auth        | Body Fields                                                                 |
|--------|-------------------------------|-------------|-----------------------------------------------------------------------------|
| POST   | `/api/student/createStudent`  | SCHOOLADMIN | `name`, `email`, `schoolId`, `classroomId?`, `phone?`, `dateOfBirth?`, `grade?`, `address?` |
| GET    | `/api/student/listStudents`   | AUTH        | `page?`, `limit?`, `schoolId?`, `classroomId?`, `grade?`                   |
| GET    | `/api/student/getStudent`     | AUTH        | `studentId`                                                                |
| PUT    | `/api/student/updateStudent`  | SCHOOLADMIN | `studentId`, `name?`, `email?`, `phone?`, `dateOfBirth?`, `grade?`, `address?`, `classroomId?` |
| DELETE | `/api/student/deleteStudent`  | SCHOOLADMIN | `studentId`                                                                |
| POST   | `/api/student/transferStudent`| SCHOOLADMIN | `studentId`, `toSchoolId`, `toClassroomId?`, `reason?`                     |
| GET    | `/api/student/getStudentHistory` | AUTH     | `studentId`                                                                |

## Database Schema (OysterDB Blocks)

### User

- Key: `user:<id>`
- Fields:
  - `_label`: `'user'`
  - `_id`: `nanoid()`
  - `username` (unique)
  - `password` (bcrypt hash, **never returned**)
  - `name`
  - `email`
  - `role` (`superadmin` / `schooladmin`)
  - `schoolId` (nullable)
  - `createdAt`, `updatedAt`

### School

- Key: `school:<id>`
- Fields:
  - `_label`: `'school'`
  - `_id`: `nanoid()`
  - `name` (unique)
  - `address`
  - `email`
  - `phone`
  - `principalName`
  - `capacity`
  - `createdAt`, `updatedAt`

### Classroom

- Key: `classroom:<id>`
- Fields:
  - `_label`: `'classroom'`
  - `_id`: `nanoid()`
  - `_hosts`: `['school:<schoolId>']`
  - `name`
  - `schoolId`
  - `capacity`
  - `grade`
  - `resources` (array)
  - `createdAt`, `updatedAt`

### Student

- Key: `student:<id>`
- Fields:
  - `_label`: `'student'`
  - `_id`: `nanoid()`
  - `_hosts`: `['school:<schoolId>', 'classroom:<classroomId?>']`
  - `name`
  - `email`
  - `phone`
  - `dateOfBirth`
  - `grade`
  - `address`
  - `schoolId`
  - `classroomId`
  - `enrolledAt`
  - `transferHistory` (array of transfer records)
  - `createdAt`, `updatedAt`

### TransferRecord

Stored inside `student.transferHistory[]`:

- `fromSchoolId`
- `fromClassroomId`
- `toSchoolId`
- `toClassroomId`
- `reason`
- `transferredAt`
- `transferredBy` (user id)

## RBAC Matrix

| Operation                                  | Superadmin | SchoolAdmin |
|--------------------------------------------|-----------:|------------:|
| Login                                      | Yes        | Yes         |
| Create user                                | Yes        | No          |
| List/get/update/delete users               | Yes        | No          |
| Create school                              | Yes        | No          |
| List/get schools                           | Yes        | Yes (AUTH)  |
| Update/delete schools                      | Yes        | No          |
| Create classroom                           | No         | Yes (own school) |
| List classrooms                            | Yes        | Scoped to own school |
| Get/update/delete classroom                | Yes        | Yes (own school only) |
| Create student                             | No         | Yes (own school) |
| List/get students                          | Yes        | Scoped to own school |
| Update/delete student                      | Yes        | Yes (own school) |
| Transfer student                           | Yes (can transfer across schools) | Yes (only from own school) |
| View student history                       | Yes        | Yes (own school) |

## Security Measures

- **JWT**:
  - Long tokens signed with `LONG_TOKEN_SECRET`, stored in the `token` header.
  - `__longToken` middleware verifies the token and injects `{ userId, role, schoolId }`.
- **Password hashing**:
  - All passwords are hashed using **bcrypt with 12 salt rounds**.
- **Rate limiting**:
  - Global: **100 requests / 15 minutes** on `/api/`.
  - Login: **10 requests / 15 minutes** on `/api/user/login`.
- **CORS**:
  - Configured via `cors({ origin: '*' })` for simplicity; tighten for production.
- **Response hygiene**:
  - Passwords are **never returned** by any manager method.
  - All database calls are wrapped in `try/catch` and return `{ error: '...' }` on failure.

## Running Tests

Integration tests are implemented in `tests/test.js` using Node’s built-in `http` module.

```bash
npm test
```

- The tests assume the API is running at `API_URL` or `http://localhost:5111`.
- To point tests to a different URL:

```bash
API_URL=http://localhost:5111 npm test
```

The suite performs a full happy-path and RBAC verification, printing ✅/❌ per test and a final summary.  
Process exit code is `1` if any test fails.

## Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start index.js --name school-management
pm2 logs school-management
pm2 restart school-management
```

### Docker

Example `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 5111
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t school-management-api .
docker run -p 5111:5111 --env-file .env school-management-api
```

### Render / Railway / Fly.io

- Provision a **Redis** instance and capture its URL.
- Set all environment variables from `.env.example` in the provider’s dashboard.
- Deploy the repository, using:
  - **Start command**: `npm start`
  - Ensure the exposed port matches `USER_PORT`.

## Assumptions & Notes

- This implementation uses **OysterDB** exclusively for persistence (no Mongo/ORM).
- Search and pagination are implemented via `oyster.call('search_find', ...)` with a simple query object.
- All RBAC decisions depend on the injected `__longToken` payload; roles are never trusted from request bodies.
- Behaviour is optimised for clarity and challenge completeness rather than raw performance; further indexing or caching can be added if needed.

>>>>>>> ac5e3eb (School management API implementation)
