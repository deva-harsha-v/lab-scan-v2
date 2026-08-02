# Security Policy & Audit Exceptions

This document details the security posture, audit exceptions, and vulnerability mitigation strategies for the LabScan console.

## 1. Active Audit Exceptions (Frontend)

During procurement and security reviews, running `npm audit` on the `frontend` workspace may flag the following advisory:

### **Advisory: React Router RSC Mode CSRF Bypass (GHSA-qwww-vcr4-c8h2)**
* **Package**: `react-router` / `react-router-dom`
* **Vulnerable Range**: `>= 7.12.0` and `< 8.3.0`
* **Current Installed Version**: `7.18.2`
* **Risk Assessment**: **Non-Applicable (Zero Risk)**
* **Technical Rationale**: 
  * The vulnerability resides exclusively in React Router's **React Server Components (RSC)** mode and Server Actions processing.
  * The LabScan frontend compiles down to a completely static Single Page Application (SPA) utilizing Vite, running entirely inside the client's browser.
  * It does not employ React Server Components, server-side actions, or Server-Side Rendering (SSR). All API communications occur via standard JSON REST endpoints handled by the Express backend.
  * Downgrading to `< 7.12.0` (such as `7.11.0`) is not recommended as it introduces older, client-affecting vulnerabilities (like open redirects). 

---

## 2. Secure Deployment Guidelines

To ensure the security of the application in production:
1. **DB SSL Validation**: Always run the backend with `DB_SSL_REJECT_UNAUTHORIZED=true` to validate certificates for Supabase or host Postgres.
2. **Environment Protection**: Never check in the `.env` file containing secrets. Only deploy `.env.example` templates and populate secrets on-target or via CI/CD environment variables.
