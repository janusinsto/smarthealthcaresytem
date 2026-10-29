
import { Router } from 'express';
import { pool } from './db.js';

const router = Router();

// List invoices

 // List invoices
router.get('/', async (req, res) => {
  try {
    const [bills] = await pool.query(`
      SELECT
        b.*,
        COALESCE(
          (SELECT SUM(p.amount)
           FROM payments p
           WHERE p.bill_id = b.bill_id), 0
        ) AS amount_paid
      FROM bills b
      ORDER BY b.created_at DESC
    `);

    res.json(bills);
  } catch (error) {
    console.error('Failed to load bills:', error);
    res.status(500).json({
      message: 'Failed to load bills',
      error: error.message
    });
  }
});


// Create invoice
router.post('/', async (req, res) => {
  const {
    patient_id,
    patient_name,
    description,
    total_amount,
    bill_date
  } = req.body;

  const amount = Number(total_amount);

  if (
    !patient_name?.trim() ||
    !description?.trim() ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(bill_date || '')
  ) {
    return res.status(400).json({
      message: 'Enter a valid patient, description, amount, and date.'
    });
  }

  try {
    const invoiceNumber =
      `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const [result] = await pool.query(
      `INSERT INTO bills
       (invoice_number, patient_id, patient_name,
        description, total_amount, bill_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Unpaid')`,
      [
        invoiceNumber,
        patient_id || null,
        patient_name.trim(),
        description.trim(),
        amount,
        bill_date
      ]
    );

    res.status(201).json({
      message: 'Invoice created successfully.',
      bill_id: result.insertId,
      invoice_number: invoiceNumber
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create invoice.' });
  }
});

// Record a payment
router.post('/:id/payments', async (req, res) => {
  const billId = Number(req.params.id);
  const amount = Number(req.body.amount);
  const method = req.body.payment_method || 'Cash';
  const reference = req.body.reference_number || null;

  if (
    !Number.isInteger(billId) ||
    billId <= 0 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !['Cash', 'Bank Transfer', 'Other'].includes(method)
  ) {
    return res.status(400).json({
      message: 'Enter a valid payment amount and method.'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM bills WHERE bill_id = ? FOR UPDATE',
      [billId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Invoice not found.' });
    }

    const [paymentRows] = await connection.query(
  `SELECT COALESCE(SUM(amount), 0) AS amount_paid
   FROM payments
   WHERE bill_id = ?`,
  [billId]
);

const amountPaid = Number(paymentRows[0].amount_paid);
const balance = Number(bill.total_amount) - amountPaid;
    if (amount > balance + 0.001) {
      await connection.rollback();
      return res.status(400).json({
        message: `Payment exceeds remaining balance of ${balance.toFixed(2)}.`
      });
    }

    await connection.query(
      `INSERT INTO payments
       (bill_id, amount, payment_method, reference_number)
       VALUES (?, ?, ?, ?)`,
      [billId, amount, method, reference]
    );

    const newPaid = amountPaid + amount;  
    const newStatus =
      newPaid >= Number(bill.total_amount) - 0.001
        ? 'Paid'
        : 'Partially Paid';

    await connection.query(
      'UPDATE bills SET amount_paid = ?, status = ? WHERE bill_id = ?',
      [newPaid, newStatus, billId]
    );

    await connection.commit();

    res.json({
      message: 'Payment recorded successfully.',
      amount_paid: newPaid,
      balance: Number(bill.total_amount) - newPaid,
      status: newStatus
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Failed to record payment.' });
  } finally {
    connection.release();
  }
});

export default router;
