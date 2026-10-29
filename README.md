# Smart Healthcare Management System — Complete Connected Project

Coursework prototype using MySQL 8 + Node.js/Express + React/Vite.

## Run order
1. Install MySQL 8, MySQL Workbench, Node.js LTS, VS Code.
2. In MySQL Workbench run, in order:
   - database/01_schema.sql
   - database/02_seed.sql
   - database/03_views_procedures_triggers.sql
3. In `backend`, copy `.env.example` to `.env`, edit DB password and JWT secret.
4. Run:
   `npm install`
   `npm run create-demo-users`
   `npm run dev`
5. In a second terminal, enter `frontend` and run:
   `npm install`
   `npm run dev`
6. Open the Vite URL, normally http://localhost:5173.

Demo accounts created by the script:
- admin@demo.local / Admin123!
- doctor@demo.local / Doctor123!
- staff@demo.local / Staff123!

Use fictional/sample data only. This is a school prototype, not a clinical system.

## 8-member work split
1. PM/System Analyst — requirements, workflow, final documentation.
2. Database Designer — ERD, 3NF, PK/FK/data dictionary.
3. SQL Developer — seed data, views, procedures, triggers, demo queries.
4. Backend Core — server, DB, authentication, JWT, RBAC.
5. Backend Clinical/Billing — CRUD routes for clinical and billing entities.
6. Frontend — React UI and API integration.
7. AI Integration — safe database assistant using approved fixed query intents.
8. Security/QA — RBAC, bcrypt, parameterized SQL, CORS, testing.

## Required design rules
- 14 related tables.
- 3NF relational design.
- REST API with CRUD routes.
- JWT + bcrypt.
- Admin, Doctor, Staff roles.
- Parameterized SQL.
- CORS.
- 3 views, 3 stored procedures, 2 triggers.
- JOIN, subquery and aggregate examples.
- AI assistant never executes arbitrary AI-generated SQL.
