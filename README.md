# Fluxio Backend
 
[![Node.js](https://img.shields.io/badge/Node.js-v20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express.js-black?logo=express)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com)
 
**Fluxio** is a  (MVP) system for inventory, product, and invoicing management, designed for small and medium-sized businesses.
 
This repository contains the project's **Backend API**, built with Node.js, Express, Prisma, and MySQL.
 
## Table of Contents
 
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Installation & Getting Started](#installation--getting-started)
- [Project Architecture](#project-architecture)
- [Roadmap](#roadmap)
- [License](#license)
## Key Features
 
-  **Authentication & Security**: registration, login, OTP verification (via email), JWT management (Access & Refresh tokens).
-  **Multi-tenant SaaS Architecture**: each user account is securely linked to a company (`Company`). Data for each company is strictly isolated.
-  **Catalog Management**: full CRUD operations for Products, Categories, and Suppliers.
-  **Reliable Stock Management**: management of stock movements (Inbound, Outbound, Customer Return, Supplier Return), secured with **Prisma transactions** to guarantee data integrity at all times.
-  **Customer Management**: customer directory and tracking.
## Tech Stack
 
| Area | Technology |
|---|---|
| Runtime | Node.js |
| Web Framework | Express.js |
| ORM | Prisma Client |
| Database | MySQL |
| Security & Auth | `jsonwebtoken`, `bcrypt`, `express-session` |
| Validation | `zod` |
| Emails | `nodemailer` |
 
## Installation & Getting Started
 
### 1. Prerequisites
 
- Node.js (v20.x recommended)
- A running MySQL server
### 2. Install dependencies
 
```bash
npm install
```
 
### 3. Environment variables
 
Create a `.env` file at the project root with at least the following variables:
 
```env
PORT=3000
DATABASE_URL="mysql://root:@localhost:3306/fluxio"
SESSION_SECRET="your_super_secret_session_key"
JWT_SECRET="your_super_secret_jwt_key"
REFRESH_TOKEN_SECRET="your_super_refresh_secret"
```
 
> !! Adjust `DATABASE_URL` with your own MySQL database credentials, and use strong, unique secrets in production. Never commit your `.env` file.
 
### 4. Database setup (Prisma)
 
To generate the Prisma client and sync the MySQL tables with the schema:
 
```bash
npx prisma generate
npx prisma db push
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
 
## Project Architecture
 
The project follows a clean N-Tier architecture, separating business logic from HTTP concerns:
 
```
fluxio-backend/
├── prisma/             # Database schema (schema.prisma)
└── src/
    ├── routes/         # API HTTP endpoint definitions
    ├── controllers/     # Receives HTTP requests, delegates to services, sends responses
    ├── services/        # Business logic of the application
    ├── repositories/     # Data access layer (interacts with Prisma to read/write to DB)
    ├── middlewares/       # Intermediate functions (e.g. JWT token check via requireAuthUser)
    └── validations/       # Validation of incoming request structure
```
 
| Layer | Role |
|---|---|
| `prisma/` | Contains the database schema (`schema.prisma`) |
| `src/routes/` | API HTTP endpoint definitions |
| `src/controllers/` | Receives HTTP requests, delegates to services, and sends responses |
| `src/services/` | Business logic of the application |
| `src/repositories/` | Data access layer (interacts with Prisma to read/write to DB) |
| `src/middlewares/` | Intermediate functions (such as JWT token verification via `requireAuthUser`) |
| `src/validations/` | Validation of incoming request structure |
