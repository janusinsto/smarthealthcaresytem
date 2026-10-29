# Team + Testing Checklist

## Member assignments
1. PM/System Analyst: requirements, workflow, documentation.
2. Database Designer: ERD, 3NF, relationships and data dictionary.
3. SQL Developer: seed data, 3 views, 3 procedures, 2 triggers, JOIN/subquery/aggregate.
4. Backend Core: Express, DB connection, JWT, RBAC and authentication.
5. Backend Clinical/Billing: CRUD for patients, doctors, schedules, appointments, records, medications, prescriptions, invoices, invoice items and payments.
6. Frontend: React pages and API integration.
7. AI: safe fixed-intent database assistant.
8. Security/QA: bcrypt, parameterized SQL, CORS, RBAC and testing.

## Test sequence
- MySQL scripts run successfully.
- `GET /api/health` returns status ok.
- All 3 demo accounts can log in.
- Missing/invalid JWT returns 401.
- Unauthorized role returns 403.
- Patient CRUD works.
- Main API resources support list/get/create/update/delete where permitted.
- JOIN, aggregate and subquery execute.
- Views/procedures/triggers work.
- AI returns results for its 3 approved intents.
- Frontend dashboard, patients, appointments, billing and AI pages load.

## Security test
Try a harmless login value like `' OR '1'='1` and verify it does not authenticate. This works as a test because SQL uses parameter placeholders.

Never put real patient information into this school project.
