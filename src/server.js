import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import appointmentsRouter from './appointments.js';

import { pool } from './db.js';
import { auth, roles } from './auth.js';

import billingRoutes from './billing.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN ||
      'http://localhost:5173',
  })
);

app.use(express.json());
app.use('/api/appointments', appointmentsRouter);
app.use('/api/billing', billingRoutes);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'Smart Healthcare API',
  });
});


app.get('/api/public/departments', async (req, res) => {
  try {
    const [departments] = await pool.execute(
      'SELECT department_id, department_name FROM departments ORDER BY department_name'
    );

    res.json(departments);
  } catch (error) {
    console.error('Departments error:', error);
    res.status(500).json({
      message: 'Unable to load departments.',
    });
  }
});


// =====================================================
// LOGIN
// =====================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    const [q] = await pool.execute(
      `SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.password_hash,
        r.role_name
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.email = ?
       AND u.is_active = TRUE`,
      [email]
    );

    if (!q.length) {
      return res.status(401).json({
        message: 'Invalid credentials',
      });
    }

    const u = q[0];

    if (!(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        userId: u.user_id,
        role: u.role_name,
        name: u.full_name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '4h',
      }
    );

    res.json({
      token,
      user: {
        id: u.user_id,
        name: u.full_name,
        role: u.role_name,
      },
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: 'Login failed',
    });
  }
});


app.post('/api/auth/register', async (req, res) => {
  let connection;

  try {
    const {
      full_name,
      email,
      password,
      license_number,
      specialization,
      department_id,
    } = req.body;

    if (
      typeof full_name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof license_number !== 'string' ||
      typeof specialization !== 'string' ||
      !department_id
    ) {
      return res.status(400).json({
        message: 'Please complete all doctor registration fields.',
      });
    }

    const cleanName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanLicense = license_number.trim();
    const cleanSpecialization = specialization.trim();
    const departmentId = Number(department_id);

    if (
      !cleanName ||
      cleanName.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 160 ||
      password.length < 8 ||
      password.length > 128 ||
      !cleanLicense ||
      cleanLicense.length > 60 ||
      !cleanSpecialization ||
      cleanSpecialization.length > 100 ||
      !Number.isSafeInteger(departmentId) ||
      departmentId < 1
    ) {
      return res.status(400).json({
        message: 'Please check your details. Password must be at least 8 characters.',
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingEmail] = await connection.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (existingEmail.length) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Email is already registered.',
      });
    }

    const [existingLicense] = await connection.execute(
      'SELECT doctor_id FROM doctors WHERE license_number = ?',
      [cleanLicense]
    );

    if (existingLicense.length) {
      await connection.rollback();
      return res.status(409).json({
        message: 'License number is already registered.',
      });
    }

    const [doctorRoles] = await connection.execute(
      'SELECT role_id FROM roles WHERE role_name = ?',
      ['Doctor']
    );

    if (!doctorRoles.length) {
      await connection.rollback();
      return res.status(500).json({
        message: 'Doctor role is missing from the database.',
      });
    }

    const [departments] = await connection.execute(
      'SELECT department_id FROM departments WHERE department_id = ?',
      [departmentId]
    );

    if (!departments.length) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Please select a valid department.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [userResult] = await connection.execute(
      `INSERT INTO users
        (role_id, full_name, email, password_hash, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [
        doctorRoles[0].role_id,
        cleanName,
        cleanEmail,
        passwordHash,
      ]
    );

    await connection.execute(
      `INSERT INTO doctors
        (user_id, department_id, license_number, specialization)
       VALUES (?, ?, ?, ?)`,
      [
        userResult.insertId,
        departmentId,
        cleanLicense,
        cleanSpecialization,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      message: 'Doctor account created successfully. You can now sign in.',
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Email or license number is already registered.',
      });
    }

    console.error('Doctor registration error:', error);

    return res.status(500).json({
      message: 'Registration failed. Please try again.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// =====================================================
// TABLE CONFIGURATION
// =====================================================

const configs = {
  patients: {
    table: 'patients',
    id: 'patient_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Staff'],
    fields: [
      'patient_code',
      'full_name',
      'birth_date',
      'sex',
      'contact_number',
      'address',
    ],
  },

  departments: {
    table: 'departments',
    id: 'department_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin'],
    fields: ['department_name'],
  },

  doctors: {
    table: 'doctors',
    id: 'doctor_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin'],
    fields: [
      'user_id',
      'department_id',
      'license_number',
      'specialization',
    ],
  },

  schedules: {
    table: 'doctor_schedules',
    id: 'schedule_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin'],
    fields: [
      'doctor_id',
      'day_of_week',
      'start_time',
      'end_time',
      'room',
    ],
  },

  appointments: {
    table: 'appointments',
    id: 'appointment_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Doctor', 'Staff'],
    fields: [
      'patient_id',
      'doctor_id',
      'appointment_datetime',
      'status',
      'reason',
    ],
  },

  records: {
    table: 'medical_records',
    id: 'record_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Doctor'],
    fields: [
      'patient_id',
      'doctor_id',
      'appointment_id',
      'diagnosis',
      'notes',
    ],
  },

  medications: {
    table: 'medications',
    id: 'medication_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Doctor'],
    fields: [
      'medication_name',
      'description',
    ],
  },

  prescriptions: {
    table: 'prescriptions',
    id: 'prescription_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Doctor'],
    fields: [
      'patient_id',
      'doctor_id',
      'appointment_id',
      'instructions',
    ],
  },

  prescriptionItems: {
    table: 'prescription_items',
    id: 'prescription_item_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Doctor'],
    fields: [
      'prescription_id',
      'medication_id',
      'dosage',
      'frequency',
      'duration',
    ],
  },

  invoices: {
    table: 'invoices',
    id: 'invoice_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Staff'],
    fields: [
      'patient_id',
      'appointment_id',
      'invoice_date',
      'total_amount',
      'status',
    ],
  },

  invoiceItems: {
    table: 'invoice_items',
    id: 'invoice_item_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Staff'],
    fields: [
      'invoice_id',
      'item_description',
      'quantity',
      'unit_price',
    ],
  },

  payments: {
    table: 'payments',
    id: 'payment_id',
    read: ['Admin', 'Doctor', 'Staff'],
    write: ['Admin', 'Staff'],
    fields: [
      'invoice_id',
      'amount',
      'payment_method',
    ],
  },
};

// =====================================================
// GENERIC CRUD ROUTER
// =====================================================

function routerFor(c) {
  const r = express.Router();

  r.use(auth);

  // GET ALL
  r.get('/', roles(...c.read), async (_, res) => {
    try {
      const [q] = await pool.query(
        `SELECT *
         FROM ${c.table}
         ORDER BY ${c.id} DESC`
      );

      res.json(q);
    } catch (e) {
      res.status(500).json({
        message: e.message,
      });
    }
  });

  // GET ONE
  r.get('/:id', roles(...c.read), async (req, res) => {
    try {
      const [q] = await pool.execute(
        `SELECT *
         FROM ${c.table}
         WHERE ${c.id} = ?`,
        [req.params.id]
      );

      q.length
        ? res.json(q[0])
        : res.status(404).json({
            message: 'Not found',
          });
    } catch (e) {
      res.status(500).json({
        message: e.message,
      });
    }
  });

  // CREATE
  r.post('/', roles(...c.write), async (req, res) => {
    try {
      const vals = c.fields.map(
        (f) => req.body[f] ?? null
      );

      const qs = c.fields
        .map(() => '?')
        .join(',');

      const [q] = await pool.execute(
        `INSERT INTO ${c.table}
        (${c.fields.join(',')})
        VALUES(${qs})`,
        vals
      );

      res.status(201).json({
        id: q.insertId,
        message: 'Created',
      });
    } catch (e) {
      res.status(400).json({
        message: e.message,
      });
    }
  });

  // UPDATE
  r.put('/:id', roles(...c.write), async (req, res) => {
    try {
      const vals = c.fields.map(
        (f) => req.body[f] ?? null
      );

      const set = c.fields
        .map((f) => `${f}=?`)
        .join(',');

      const [q] = await pool.execute(
        `UPDATE ${c.table}
         SET ${set}
         WHERE ${c.id}=?`,
        [...vals, req.params.id]
      );

      q.affectedRows
        ? res.json({
            message: 'Updated',
          })
        : res.status(404).json({
            message: 'Not found',
          });
    } catch (e) {
      res.status(400).json({
        message: e.message,
      });
    }
  });

  // DELETE
  r.delete('/:id', roles('Admin'), async (req, res) => {
    try {
      const [q] = await pool.execute(
        `DELETE FROM ${c.table}
         WHERE ${c.id}=?`,
        [req.params.id]
      );

      q.affectedRows
        ? res.json({
            message: 'Deleted',
          })
        : res.status(404).json({
            message: 'Not found',
          });
    } catch (e) {
      res.status(400).json({
        message:
          'Delete failed; record may be referenced by another table.',
      });
    }
  });

  return r;
}

// =====================================================
// REGISTER ROUTES
// =====================================================

for (const [name, c] of Object.entries(configs)) {
  app.use(
    '/api/' +
      name.replace(
        /[A-Z]/g,
        (m) => '-' + m.toLowerCase()
      ),
    routerFor(c)
  );
}

// =====================================================
// DASHBOARD
// =====================================================

app.get(
  '/api/dashboard/summary',
  auth,
  roles('Admin', 'Doctor', 'Staff'),
  async (_, res) => {
    try {
      const [[p]] = await pool.query(
        'SELECT COUNT(*) count FROM patients'
      );

      const [[d]] = await pool.query(
        'SELECT COUNT(*) count FROM doctors'
      );

      const [[a]] = await pool.query(
        'SELECT COUNT(*) count FROM appointments'
      );

      const [[i]] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) total
         FROM invoices
         WHERE status <> 'Paid'`
      );

      res.json({
        patients: p.count,
        doctors: d.count,
        appointments: a.count,
        unpaidAmount: i.total,
      });
    } catch (e) {
      res.status(500).json({
        message: e.message,
      });
    }
  }
);

// =====================================================
// AI QUERY
// =====================================================

app.post(
  '/api/ai/query',
  auth,
  roles('Admin', 'Doctor', 'Staff'),
  async (req, res) => {
    try {
      const {
        intent,
        patientCode,
        status,
      } = req.body;

      // Patient appointment count
      if (intent === 'patient_appointment_count') {
        const [q] = await pool.execute(
          `SELECT
            p.patient_code,
            p.full_name,
            COUNT(a.appointment_id) appointment_count
           FROM patients p
           LEFT JOIN appointments a
             ON a.patient_id = p.patient_id
           WHERE p.patient_code = ?
           GROUP BY
            p.patient_id,
            p.patient_code,
            p.full_name`,
          [patientCode]
        );

        return res.json({
          explanation:
            'Appointment count for the selected patient.',
          result: q,
        });
      }

      // Appointments by status
      if (intent === 'appointments_by_status') {
        if (
          ![
            'Pending',
            'Confirmed',
            'Completed',
            'Cancelled',
          ].includes(status)
        ) {
          return res.status(400).json({
            message: 'Invalid status',
          });
        }

        const [q] = await pool.execute(
          `SELECT
            appointment_id,
            appointment_datetime,
            status,
            reason
           FROM appointments
           WHERE status = ?
           ORDER BY appointment_datetime`,
          [status]
        );

        return res.json({
          explanation:
            'Appointments with the selected status.',
          result: q,
        });
      }

      // Unpaid invoices
      if (intent === 'unpaid_invoices') {
        const [q] = await pool.query(
          `SELECT
            i.invoice_id,
            p.patient_code,
            p.full_name,
            i.invoice_date,
            i.total_amount,
            i.status
           FROM invoices i
           JOIN patients p
             ON p.patient_id = i.patient_id
           WHERE i.status <> 'Paid'
           ORDER BY i.invoice_date DESC`
        );

        return res.json({
          explanation: 'Invoices not fully paid.',
          result: q,
        });
      }

      res.status(400).json({
        message: 'Unsupported intent',
      });
    } catch (e) {
      res.status(500).json({
        message: e.message,
      });
    }
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(port, () => {
  console.log(
    `API running at http://localhost:${port}`
  );
});