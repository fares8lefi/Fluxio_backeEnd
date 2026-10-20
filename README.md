# Fluxio Backend

[![Node.js](https://img.shields.io/badge/Node.js-v24.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express.js-black?logo=express)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com)

**Fluxio** is a (MVP) system for inventory, product, and invoicing management, designed for small and medium-sized businesses (Tunisian tax rules: VAT, fiscal stamp, withholding tax).

This repository contains the project's **Backend API**, built with Node.js, Express, Prisma, and MySQL.

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Installation & Getting Started](#installation--getting-started)
- [Running with Docker](#running-with-docker)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Security](#security)
- [Tests](#tests)
- [API Overview](#api-overview)
- [Project Architecture](#project-architecture)

## Key Features

- **Authentication & Security**: registration, login, OTP verification (via email), JWT management (Access & Refresh tokens in cookies).
- **Multi-tenant SaaS Architecture**: each user account is linked to a company (`Company`). Data for each company is strictly isolated: linked clients and suppliers must belong to the same company, and client phone / tax ID are unique **per company**.
- **Team Management**: invitations by email with roles (Owner, Stock keeper, Accountant).
- **Catalog Management**: full CRUD operations for Products, Categories, Suppliers, and Clients.
- **Reliable Stock Management**: stock movements (Inbound, Outbound, Customer Return, Supplier Return) and inventories, secured with **Prisma transactions**.
- **Quotes & Invoicing**: quotes convertible to invoices, PDF invoices, payments (partial or full), and credit notes. A credited invoice can no longer be cancelled or receive payments.
- **Dashboards & Exports**: manager KPIs (periods computed in Tunis time), admin dashboard, CSV exports.

## Tech Stack

| Area            | Technology                                               |
| --------------- | -------------------------------------------------------- |
| Runtime         | Node.js                                                  |
| Web Framework   | Express.js                                               |
| ORM             | Prisma Client                                            |
| Database        | MySQL                                                    |
| Security & Auth | `jsonwebtoken`, `bcrypt`, `helmet`, `express-rate-limit` |
| Validation      | `zod`                                                    |
| Emails          | `nodemailer`                                             |
| Tests           | `jest`, `artillery` (load tests)                         |

## Installation & Getting Started

### 1. Prerequisites

- Node.js (v24.x)
- A running MySQL server (or Docker, see below)

### 2. Install dependencies

```bash
npm install
```

The Prisma client is generated automatically after install (`postinstall`).

### 3. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.Exemple .env
```

See [Environment Variables](#environment-variables) for the full list.

> !! Use strong, unique secrets in production. Never commit your `.env` file.

### 4. Database setup (Prisma)

Apply the migrations to your database:

```bash
npx prisma migrate deploy
```

In development, to create a new migration after changing `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name <migration_name>
```

### 5. Start the server

In development mode (with auto-reload via Nodemon):

```bash
npm run dev
```

In production mode:

```bash
npm start
```

## Running with Docker

`docker-compose.yml` starts a MySQL 8.4 database and the backend. Migrations are applied automatically at startup.

1. Set `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER` and `MYSQL_PASSWORD` in `.env` (no password is hardcoded).
2. Run:

```bash
docker compose up --build
```

The API is available at `http://localhost:3000`.

## Environment Variables

| Variable                                                                | Required    | Description                                                                 |
| ----------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                                                          | yes         | MySQL connection string (`mysql://user:password@host:3306/db`)              |
| `PORT`                                                                  | no          | HTTP port (default `3000`)                                                  |
| `SESSION_SECRET`                                                        | yes         | Session secret                                                              |
| `net_Secret`                                                            | yes         | JWT access token secret (exact name read by the code)                       |
| `REFRESH_TOKEN_SECRET`                                                  | yes         | JWT refresh token secret                                                    |
| `ACCESS_TOKEN_EXPIRY`                                                   | no          | Access token lifetime (e.g. `15m`)                                          |
| `REFRESH_TOKEN_EXPIRY`                                                  | no          | Refresh token lifetime (e.g. `10d`)                                         |
| `EmailUser` / `EmailPassword`                                           | yes         | SMTP account used to send OTP and invitation emails                         |
| `FRONTEND_URL`                                                          | no          | Allowed frontend origins, comma-separated (default `http://localhost:5173`) |
| `COOKIE_SAMESITE`                                                       | no          | `lax` (default) or `none` if the frontend is served from another site       |
| `TRUST_PROXY`                                                           | no          | Number of proxies to trust (behind a reverse proxy / Vercel)                |
| `limitByPage`                                                           | no          | Page size for paginated lists (default `10`)                                |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Docker only | Used by `docker-compose.yml`                                                |

## Scripts

| Command                    | Description                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`              | Start the server with Nodemon                                                |
| `npm start`                | Start the server                                                             |
| `npm test`                 | Run the Jest test suite                                                      |
| `npm run e2e`              | Run the Artillery load test (`tests/artillerr.yml`)                          |
| `npm run lint`             | Lint the code with ESLint                                                    |
| `npm run format`           | Format the code with Prettier                                                |
| `npm run fix:credit-notes` | Dry run of the one-off fix for legacy credit notes and withholding tax rates |

To apply the credit note fix (writes to the database):

```bash
node scripts/fix-credit-notes.js --apply
```

## Security

- **CORS** limited to `FRONTEND_URL`, with credentials.
- **CSRF protection**: write requests (`POST`, `PUT`, `PATCH`, `DELETE`) coming from a browser must have an allowed `Origin` / `Referer`. Only JSON bodies are accepted (no `urlencoded` parser).
- **No admin at signup**: the `admin` role can never be set through registration.
- **Mass-assignment protection**: only validated fields are saved (e.g. `companyId` sent by the client is ignored).
- **HTML escaping** of user data in emails.
- `helmet` headers and rate limiting.

## Tests

```bash
npm test
```

Unit tests live in `tests/unit/` and cover controllers, routes, middlewares, repositories, services, utils, validations and scripts (Prisma is mocked, no database needed). A coverage report is generated in `coverage/`.

## API Overview

| Prefix                   | Resource                         |
| ------------------------ | -------------------------------- |
| `/api/users`             | Auth, account, OTP               |
| `/api/company`           | Company profile                  |
| `/api/team`              | Team members & invitations       |
| `/api/categories`        | Product categories               |
| `/api/products`          | Products                         |
| `/api/suppliers`         | Suppliers                        |
| `/api/clients`           | Clients                          |
| `/api/mouvments`         | Stock movements                  |
| `/api/quotes`            | Quotes                           |
| `/api/invoices`          | Invoices, payments, credit notes |
| `/api/dashboard`         | Dashboard                        |
| `/api/dashboard/manager` | Manager KPIs                     |
| `/api/exports`           | CSV exports                      |
| `/api/admin`             | Platform administration          |
| `/health`                | Health check                     |

## Project Architecture

The project follows a clean N-Tier architecture, separating business logic from HTTP concerns:

```
fluxio-backend/
├── config/             # Prisma client instance
├── prisma/             # Database schema (schema.prisma) and migrations
├── scripts/            # One-off maintenance scripts
├── tests/              # Unit tests (Jest) and load tests (Artillery)
└── src/
    ├── routes/         # API HTTP endpoint definitions
    ├── controllers/    # Receives HTTP requests, delegates to services, sends responses
    ├── services/       # Business logic of the application
    ├── repositories/   # Data access layer (interacts with Prisma to read/write to DB)
    ├── middlewares/    # Auth (JWT), roles, active user, origin check (CSRF)
    ├── validations/    # Validation of incoming request structure (zod)
    └── utils/          # Tax engine, invoice readiness, cookie options…
```

| Layer               | Role                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `prisma/`           | Database schema (`schema.prisma`) and migrations                    |
| `src/routes/`       | API HTTP endpoint definitions                                       |
| `src/controllers/`  | Receives HTTP requests, delegates to services, and sends responses  |
| `src/services/`     | Business logic of the application                                   |
| `src/repositories/` | Data access layer (interacts with Prisma to read/write to DB)       |
| `src/middlewares/`  | Intermediate functions (JWT verification, roles, CSRF origin check) |
| `src/validations/`  | Validation of incoming request structure                            |
| `src/utils/`        | Shared helpers (tax engine, invoice readiness, cookie options)      |
