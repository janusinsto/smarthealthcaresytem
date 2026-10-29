
import { Router } from 'express';
import { pool } from './db.js';
import { auth, roles } from './auth.js';

const router = Router();

const allowedStatuses = [
  'Pending',
  'Confirmed',
  'Completed',
  'Cancelled',
];

const canRead = roles('Admin', 'Doctor', 'Staff');
const canManage = roles('Admin', 'Doctor', 'Staff');

// GET dashboard counts
router.get('/dashboard', auth, canRead, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(status = 'Pending'), 0) AS pending,
        COALESCE(SUM(status = 'Confirmed'), 0) AS confirmed,
        COALESCE(SUM(status = 'Completed'), 0) AS completed,
        COALESCE(SUM(status = 'Cancelled'), 0) AS cancelled
      FROM appointments
    `);

    const row = rows[0];

    res.json({
      total: Number(row.total),
      pending: Number(row.pending),
      confirmed: Number(row.confirmed),
      completed: Number(row.completed),
      cancelled: Number(row.cancelled),
    });
  } catch (error) {
    console.error('Appointment dashboard error:', error);
    res.status(500).json({
      message: 'Failed to load appointment dashboard.',
    });
  }
});

// GET appointment list with patient and doctor names
router.get('/', auth, canRead, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.appointment_id,
        a.patient_id,
        p.patient_code,
        p.full_name AS patient_name,
        a.doctor_id,
        u.full_name AS doctor_name,
        a.appointment_datetime,
        a.status,
        a.reason,
        a.created_at
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN users u ON u.user_id = d.user_id
      ORDER BY a.appointment_datetime DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      message: 'Failed to retrieve appointments.',
    });
  }
});

// GET patients for booking form
router.get('/options/patients', auth, canRead, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT patient_id, patient_code, full_name
      FROM patients
      ORDER BY full_name
    `);

    res.json(rows);
  } catch (error) {
    console.error('Load patients error:', error);
    res.status(500).json({
      message: 'Failed to load patients.',
    });
  }
});

// GET doctors for booking form
router.get('/options/doctors', auth, canRead, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        d.doctor_id,
        u.full_name AS doctor_name,
        d.specialization
      FROM doctors d
      JOIN users u ON u.user_id = d.user_id
      ORDER BY u.full_name
    `);

    res.json(rows);
  } catch (error) {
    console.error('Load doctors error:', error);
    res.status(500).json({
      message: 'Failed to load doctors.',
    });
  }
});

// CREATE appointment
router.post('/', auth, canManage, async (req, res) => {
  const patientId = Number(req.body.patient_id);
  const doctorId = Number(req.body.doctor_id);
  const dateTime = req.body.appointment_datetime;
  const reason = typeof req.body.reason === 'string'
    ? req.body.reason.trim()
    : '';

  if (
    !Number.isSafeInteger(patientId) || patientId < 1 ||
    !Number.isSafeInteger(doctorId) || doctorId < 1 ||
    typeof dateTime !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dateTime) ||
    !reason ||
    reason.length > 255
  ) {
    return res.status(400).json({
      message: 'Provide a valid patient, doctor, date/time, and reason (maximum 255 characters).',
    });
  }

  try {
    const [patients] = await pool.execute(
      'SELECT patient_id FROM patients WHERE patient_id = ?',
      [patientId]
    );

    if (!patients.length) {
      return res.status(400).json({
        message: 'Selected patient does not exist.',
      });
    }

    const [doctors] = await pool.execute(
      'SELECT doctor_id FROM doctors WHERE doctor_id = ?',
      [doctorId]
    );

    if (!doctors.length) {
      return res.status(400).json({
        message: 'Selected doctor does not exist.',
      });
    }

    const mysqlDateTime = dateTime.replace('T', ' ').length === 16
      ? dateTime.replace('T', ' ') + ':00'
      : dateTime.replace('T', ' ');

    const [result] = await pool.execute(
      `INSERT INTO appointments
        (patient_id, doctor_id, appointment_datetime, reason, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [patientId, doctorId, mysqlDateTime, reason]
    );

    const [rows] = await pool.execute(
      'SELECT * FROM appointments WHERE appointment_id = ?',
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      message: 'Failed to save appointment.',
    });
  }
});

// UPDATE appointment details or status
router.patch('/:id', auth, canManage, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      message: 'Invalid appointment ID.',
    });
  }

  const allowedFields = [
    'patient_id',
    'doctor_id',
    'appointment_datetime',
    'reason',
    'status',
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({
      message: 'No changes provided.',
    });
  }

  if (
    updates.status !== undefined &&
    !allowedStatuses.includes(updates.status)
  ) {
    return res.status(400).json({
      message: 'Invalid appointment status.',
    });
  }

  if (
    updates.reason !== undefined &&
    (typeof updates.reason !== 'string' ||
      !updates.reason.trim() ||
      updates.reason.trim().length > 255)
  ) {
    return res.status(400).json({
      message: 'Reason is required and must not exceed 255 characters.',
    });
  }

  if (
    updates.patient_id !== undefined &&
    (!Number.isSafeInteger(Number(updates.patient_id)) ||
      Number(updates.patient_id) < 1)
  ) {
    return res.status(400).json({
      message: 'Invalid patient ID.',
    });
  }

  if (
    updates.doctor_id !== undefined &&
    (!Number.isSafeInteger(Number(updates.doctor_id)) ||
      Number(updates.doctor_id) < 1)
  ) {
    return res.status(400).json({
      message: 'Invalid doctor ID.',
    });
  }

  if (updates.appointment_datetime !== undefined) {
    const value = updates.appointment_datetime;

    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
    ) {
      return res.status(400).json({
        message: 'Invalid appointment date/time.',
      });
    }

    updates.appointment_datetime =
      value.replace('T', ' ').length === 16
        ? value.replace('T', ' ') + ':00'
        : value.replace('T', ' ');
  }

  try {
    if (updates.patient_id !== undefined) {
      const [rows] = await pool.execute(
        'SELECT patient_id FROM patients WHERE patient_id = ?',
        [Number(updates.patient_id)]
      );

      if (!rows.length) {
        return res.status(400).json({
          message: 'Selected patient does not exist.',
        });
      }

      updates.patient_id = Number(updates.patient_id);
    }

    if (updates.doctor_id !== undefined) {
      const [rows] = await pool.execute(
        'SELECT doctor_id FROM doctors WHERE doctor_id = ?',
        [Number(updates.doctor_id)]
      );

      if (!rows.length) {
        return res.status(400).json({
          message: 'Selected doctor does not exist.',
        });
      }

      updates.doctor_id = Number(updates.doctor_id);
    }

    const columns = Object.keys(updates);
    const values = columns.map((field) =>
      field === 'reason' ? updates[field].trim() : updates[field]
    );

    const [result] = await pool.execute(
      `UPDATE appointments
       SET ${columns.map((field) => `${field} = ?`).join(', ')}
       WHERE appointment_id = ?`,
      [...values, id]
    );

    if (!result.affectedRows) {
      const [existing] = await pool.execute(
        'SELECT appointment_id FROM appointments WHERE appointment_id = ?',
        [id]
      );

      if (!existing.length) {
        return res.status(404).json({
          message: 'Appointment not found.',
        });
      }
    }

    const [rows] = await pool.execute(
      'SELECT * FROM appointments WHERE appointment_id = ?',
      [id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      message: 'Failed to update appointment.',
    });
  }
});

export default router;
