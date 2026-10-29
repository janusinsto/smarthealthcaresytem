
import React, { useCallback, useEffect, useState } from 'react';
import './billing.css';

const API = 'http://localhost:4000/api/billing';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const money = value =>
  '₱' + Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const emptyForm = () => ({
  patient_name: '',
  patient_id: '',
  description: '',
  total_amount: '',
  bill_date: today()
});

export default function Billing() {
  const [bills, setBills] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [payment, setPayment] = useState({
    billId: '',
    amount: '',
    payment_method: 'Cash',
    reference_number: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const request = async (url, options = {}) => {
    const token = localStorage.getItem('token');

    if (!token) {
      throw new Error('Please log in again.');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Request failed.');
    }

    return data;
  };

  const loadBills = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await request(API);
      setBills(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleCreate = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await request(API, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          patient_id: form.patient_id || null,
          total_amount: Number(form.total_amount)
        })
      });

      setForm(emptyForm());
      setMessage('Invoice created successfully.');
      await loadBills();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await request(`${API}/${payment.billId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payment.amount),
          payment_method: payment.payment_method,
          reference_number: payment.reference_number || null
        })
      });

      setMessage('Payment recorded successfully.');
      setPayment({
        billId: '',
        amount: '',
        payment_method: 'Cash',
        reference_number: ''
      });
      await loadBills();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredBills = bills.filter(bill =>
    `${bill.invoice_number} ${bill.patient_name} ${bill.description}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalBilled = bills.reduce(
    (sum, bill) => sum + Number(bill.total_amount || 0), 0
  );

  const totalPaid = bills.reduce(
    (sum, bill) => sum + Number(bill.amount_paid || 0), 0
  );

  const balance = totalBilled - totalPaid;

  const selectedBill = bills.find(
    bill => String(bill.bill_id) === String(payment.billId)
  );

  return (
    <main className="billing-page">
      <header className="billing-header">
        <div>
          <p className="billing-eyebrow">FINANCE MANAGEMENT</p>
          <h1>Billing & Payments</h1>
          <p className="billing-subtitle">
            Manage patient invoices, payments, and outstanding balances.
          </p>
        </div>
        <button className="billing-refresh" onClick={loadBills}>
          ↻ Refresh
        </button>
      </header>

      {error && <div className="billing-alert error">{error}</div>}
      {message && <div className="billing-alert success">{message}</div>}

      <section className="billing-stats">
        <article className="billing-stat">
          <span>Total billed</span>
          <strong>{money(totalBilled)}</strong>
          <small>{bills.length} invoices</small>
        </article>

        <article className="billing-stat">
          <span>Payments received</span>
          <strong>{money(totalPaid)}</strong>
          <small>Recorded payments</small>
        </article>

        <article className="billing-stat">
          <span>Outstanding balance</span>
          <strong>{money(balance)}</strong>
          <small>Remaining amount due</small>
        </article>
      </section>

      <section className="billing-panel">
        <h2>Create an invoice</h2>
        <form className="billing-form" onSubmit={handleCreate}>
          <label>
            Patient name *
            <input
              required
              maxLength={150}
              value={form.patient_name}
              onChange={e => setForm({
                ...form, patient_name: e.target.value
              })}
              placeholder="Enter patient name"
            />
          </label>

          <label>
            Patient ID (optional)
            <input
              type="number"
              min="1"
              value={form.patient_id}
              onChange={e => setForm({
                ...form, patient_id: e.target.value
              })}
              placeholder="Patient ID"
            />
          </label>

          <label>
            Service or description *
            <input
              required
              maxLength={255}
              value={form.description}
              onChange={e => setForm({
                ...form, description: e.target.value
              })}
              placeholder="e.g. Consultation fee"
            />
          </label>

          <label>
            Total amount (₱) *
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.total_amount}
              onChange={e => setForm({
                ...form, total_amount: e.target.value
              })}
              placeholder="0.00"
            />
          </label>

          <label>
            Invoice date *
            <input
              required
              type="date"
              value={form.bill_date}
              onChange={e => setForm({
                ...form, bill_date: e.target.value
              })}
            />
          </label>

          <div className="billing-form-action">
            <button disabled={saving} type="submit">
              {saving ? 'Saving...' : '+ Create invoice'}
            </button>
          </div>
        </form>
      </section>

      <section className="billing-panel">
        <h2>Record a payment</h2>

        <form className="billing-form" onSubmit={handlePayment}>
          <label>
            Select invoice *
            <select
              required
              value={payment.billId}
              onChange={e => setPayment({
                ...payment, billId: e.target.value, amount: ''
              })}
            >
              <option value="">Choose an unpaid invoice</option>
              {bills.filter(b =>
                Number(b.total_amount) > Number(b.amount_paid)
              ).map(b => (
                <option key={b.bill_id} value={b.bill_id}>
                  {b.invoice_number} — {b.patient_name} — Balance:{' '}
                  {money(Number(b.total_amount) - Number(b.amount_paid))}
                </option>
              ))}
            </select>
          </label>

          <label>
            Payment amount (₱) *
            <input
              required
              type="number"
              min="0.01"
              max={selectedBill
                ? (Number(selectedBill.total_amount) -
                   Number(selectedBill.amount_paid)).toFixed(2)
                : undefined}
              step="0.01"
              value={payment.amount}
              onChange={e => setPayment({
                ...payment, amount: e.target.value
              })}
              placeholder="0.00"
            />
          </label>

          <label>
            Payment method
            <select
              value={payment.payment_method}
              onChange={e => setPayment({
                ...payment, payment_method: e.target.value
              })}
            >
              <option>Cash</option>
              <option>Bank Transfer</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Reference number (optional)
            <input
              maxLength={100}
              value={payment.reference_number}
              onChange={e => setPayment({
                ...payment, reference_number: e.target.value
              })}
              placeholder="Receipt or transaction reference"
            />
          </label>

          {selectedBill && (
            <p className="billing-balance-note">
              Remaining balance: <strong>
                {money(Number(selectedBill.total_amount) -
                  Number(selectedBill.amount_paid))}
              </strong>
            </p>
          )}

          <div className="billing-form-action">
            <button disabled={saving} type="submit">
              {saving ? 'Saving...' : 'Record payment'}
            </button>
          </div>
        </form>
      </section>

      <section className="billing-panel">
        <div className="billing-list-header">
          <div>
            <h2>Invoices</h2>
            <p>View and search patient billing records.</p>
          </div>

          <input
            className="billing-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoices..."
          />
        </div>

        {loading ? (
          <p className="billing-empty">Loading invoices...</p>
        ) : filteredBills.length === 0 ? (
          <p className="billing-empty">No invoices found.</p>
        ) : (
          <div className="billing-table-wrap">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map(bill => {
                  const total = Number(bill.total_amount);
                  const paid = Number(bill.amount_paid);
                  const remaining = Math.max(0, total - paid);

                  return (
                    <tr key={bill.bill_id}>
                      <td>{bill.invoice_number}</td>
                      <td>{bill.patient_name}</td>
                      <td>{bill.description}</td>
                      <td>
                        {String(bill.bill_date).slice(0, 10)}
                      </td>
                      <td>{money(total)}</td>
                      <td>{money(paid)}</td>
                      <td>{money(remaining)}</td>
                      <td>
                        <span className={
                          'billing-status ' +
                          bill.status.toLowerCase().replace(' ', '-')
                        }>
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
