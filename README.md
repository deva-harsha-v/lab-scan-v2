# LabScan: Multi-Agent Lab & Student Experiment Console

An enterprise-ready, containerized web application designed for academic institutions to manage physical lab environments, track student progress, verify physical presence via ArUco markers, and automate student account ingestion securely.

---

## Architecture & Tech Stack
- **Backend API**: Node.js, Express, PostgreSQL (node-postgres), express-rate-limit, Zod validators, double-submit cookie CSRF protection.
- **Frontend App**: React, Vite, Vanilla CSS (curated design system, responsive dashboards).
- **Orchestration**: Docker, Docker Compose, Multi-stage Nginx static servers.

---

## 1. Environment Configuration

### Backend Configuration
Copy the template from `backend/.env.example` to `backend/.env`.

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Integer | `5000` | Port for Express REST API to listen on. |
| `JWT_ACCESS_SECRET` | String | *Required* | 64-byte secure hex string for Access Token signing. |
| `JWT_REFRESH_SECRET` | String | *Required* | 64-byte secure hex string for Refresh Token signing. |
| `JWT_ACCESS_EXPIRY` | Duration | `15m` | Lifetime of JWT Access Token (e.g. `15m`, `1h`). |
| `JWT_REFRESH_EXPIRY` | Duration | `7d` | Lifetime of JWT Refresh Token (e.g. `7d`, `30d`). |
| `DATABASE_URL` | String | *Required* | PostgreSQL connection string (must include `sslmode=require` in production). |
| `DB_SSL_REJECT_UNAUTHORIZED` | Boolean | `true` | Enforces DB certificate validation. Set `false` only in local development. |
| `DB_POOL_MAX` | Integer | `20` | Maximum number of concurrent connections in the PG pool. |
| `ALLOWED_ORIGINS` | String | *Required* | Comma-separated list of CORS origins allowed in production. |
| `MEDIA_SIGN_SECRET` | String | *Required* | Secret key used to verify QR/marker signatures. |
| `SENTRY_DSN` | String | *Optional* | Sentry project DSN for backend error logging. |

### Frontend Configuration
Copy the template from `frontend/.env.example` to `frontend/.env`.

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE` | String | *Required* | Base URL of the REST API (must be specified at build time). If missing, the app will throw a fatal boot error to prevent broken deployments. |
| `VITE_SENTRY_DSN` | String | *Optional* | Sentry project DSN for frontend error logging. |

---

## 2. Docker Deployment Guide

For production deployments, the application is containerized and managed using Docker Compose.

### Quick Start
Build and run the entire stack (Database, API Backend, and Frontend Client):
```bash
docker compose up --build -d
```

### Clean Rebuild
```bash
docker compose down --volumes
docker compose up --build -d
```
The application will be accessible at:
- **Frontend Client**: `http://localhost` (Port 80)
- **REST API Server**: `http://127.0.0.1:5000` (Port 5000)

---

## 3. Database Migrations & Versioning

Database schema migrations are fully versioned and managed programmatically on startup by `backend/src/config/migrate.js`.
- **Directory**: `backend/db/migrations/*.sql`
- **Execution**: Scripts are applied alphabetically.
- **Idempotency**: Successful migrations are logged to the `schema_migrations` tracking table. Subsequent boots will skip already applied versions.

To run migrations manually:
```bash
npm run db:migrate
```

---

## 4. Backup & Restore Strategy (IT Runbook)

Academic institutions must perform scheduled backups of the PostgreSQL database.

### Automated SQL Dump (Backup)
To generate an encrypted, compressed snapshot of the schema and tables:
```bash
docker exec -t labscan-db pg_dump -U postgres -F c -b -v -f /tmp/labscan_backup.dump postgres
docker cp labscan-db:/tmp/labscan_backup.dump ./backups/
```

### Full Restore
To restore from a backup file (this will wipe and rebuild the active database):
```bash
docker cp ./backups/labscan_backup.dump labscan-db:/tmp/
docker exec -t labscan-db pg_restore -U postgres -d postgres -c -v /tmp/labscan_backup.dump
```

---

## 5. API Endpoints Reference

### Health Checks
- `GET /health/live` - Verify server process is running.
- `GET /health/ready` - Verify database connection handshake.

### Authentication & Intake
- `POST /api/auth/login` - Authenticate users (student/admin) and set HTTP-only cookies.
- `POST /api/auth/logout` - Clear JWT access/refresh cookies.
- `PUT /api/auth/change-password` - Update currently logged-in user's password.
- `POST /api/auth/register-student` - Admin-restricted single student account creation.
- `POST /api/auth/bulk-import` - Admin-restricted bulk Excel student ingestion (max 500 records).

### Lab & Experiment Management
- `GET /api/labs` - List academic lab sections.
- `POST /api/labs` - Create a new academic lab department.
- `POST /api/experiments` - Add an experiment sequence to a lab (AR marker ID, theories, checklist).

### Student Experiment Sessions
- `POST /api/sessions/start` - Open or resume an experiment workbench session.
- `PUT /api/sessions/progress` - Update elapsed video duration or complete stage theory.
- `PUT /api/sessions/checklist` - Toggle checklist item verification state.

---

## 6. Verification & Tests

To run the built-in integration tests suite (zero dependencies, uses native Node.js test runner):
```bash
cd backend
npm test
```
The suite verifies password complexity rules, student registration constraints, database shims, and JWT signature security.

---

## 7. Security Policy & Audit Exceptions

Running `npm audit` on the `frontend` workspace will flag a high-severity advisory on the `react-router` dependency (GHSA-qwww-vcr4-c8h2 - RSC Mode CSRF Bypass).

This finding is **non-applicable (zero risk)** for this project. The LabScan console is compiled as a static client-side SPA with zero React Server Components (RSC) or Server-Side Rendering (SSR) runtime. 

For full details, please refer to [SECURITY.md](file:///C:/Users/devah/Downloads/labscan-ag/SECURITY.md) in the root directory.
