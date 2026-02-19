# Submission — School Management System API

This deliverable is submitted as a **folder/zip upload** (no repository or deployment required).

---

## How to run (evaluator / local)

1. **Redis** must be running on `localhost:6379`.
   - **With Docker:** `docker run -d --name redis-school -p 6379:6379 redis:7`
   - **Local install:** Install Redis and start the service so it listens on port 6379.

2. **Install and start:**
   ```bash
   npm install
   npm start
   ```
   A default superadmin is seeded on first start (username: `superadmin`, password: `Admin@1234`).

3. **Run tests** (in a second terminal while the API is running):
   ```bash
   npm test
   ```

4. **Auth:** Use header **`token: <jwt>`** (not `Authorization: Bearer`) for protected endpoints. Get a JWT via `POST /api/user/login` with `{"username":"superadmin","password":"Admin@1234"}`.

5. **Health check:** `GET /health` returns service info.

---

## What’s included

- Full API (schools, classrooms, students, users; JWT + RBAC).
- `.env` with defaults for local/Docker Redis.
- Integration test suite in `tests/test.js`.
- README with API reference, schema, and setup.
