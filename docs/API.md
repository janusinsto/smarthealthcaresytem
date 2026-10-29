# API
Base: http://localhost:4000/api

Public: GET /health, POST /auth/login
Protected CRUD: /patients, /departments, /doctors, /schedules, /appointments, /records, /medications, /prescriptions, /prescription-items, /invoices, /invoice-items, /payments
Dashboard: GET /dashboard/summary
AI: POST /ai/query

Protected calls use `Authorization: Bearer <JWT>`.
All SQL values are parameterized. AI uses fixed server-side query templates.
