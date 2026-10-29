import Appointments from './Appointments';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import Billing from './billing';

const API = 'http://localhost:4000/api';

// =====================================================
// AUTH HELPERS
// =====================================================

const token = () => localStorage.getItem('token') || '';

const user = () =>
  JSON.parse(localStorage.getItem('user') || 'null');

// =====================================================
// API HELPER
// =====================================================

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token()) {
    headers.Authorization = 'Bearer ' + token();
  }

  const response = await fetch(API + path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Error(data.message || 'Request failed');
  }

  return data;
}

// =====================================================
// LOGIN
// =====================================================



function Login({ done }) {
  const [isRegister, setIsRegister] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isRegister) return;

    api('/public/departments')
      .then(setDepartments)
      .catch((err) => setError(err.message));
  }, [isRegister]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isRegister) {
        if (password.length < 8) {
          throw Error('Password must be at least 8 characters.');
        }

        if (password !== confirmPassword) {
          throw Error('Passwords do not match.');
        }

        const result = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
            license_number: licenseNumber.trim(),
            specialization: specialization.trim(),
            department_id: Number(departmentId),
          }),
        });

        setIsRegister(false);
        setPassword('');
        setConfirmPassword('');
        setFullName('');
        setLicenseNumber('');
        setSpecialization('');
        setDepartmentId('');
        setMessage(
          result.message || 'Doctor account created. You can now sign in.'
        );
      } else {
        const data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        });

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        done(data.user);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={handleSubmit}>
        <h1>Smart Healthcare</h1>

        <p>
          {isRegister
            ? 'Doctor Registration'
            : 'Healthcare Management System'}
        </p>

        {isRegister && (
          <>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              maxLength={120}
              required
            />

            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="Professional license number"
              maxLength={60}
              required
            />

            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="Specialization"
              maxLength={100}
              required
            />

            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option
                  key={department.department_id}
                  value={department.department_id}
                >
                  {department.department_name}
                </option>
              ))}
            </select>
          </>
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          maxLength={160}
          required
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (at least 8 characters)"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          minLength={isRegister ? 8 : undefined}
          required
        />

        {isRegister && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        )}

        {message && <p className="success">{message}</p>}
        {error && <p className="err">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading
            ? 'Please wait...'
            : isRegister
              ? 'Register as Doctor'
              : 'Sign in'}
        </button>

        <p>
          {isRegister
            ? 'Already have an account?'
            : "Don't have an account?"}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setMessage('');
            }}
          >
            {isRegister ? 'Sign in' : 'Register as Doctor'}
          </button>
        </p>
      </form>
    </div>
  );
}


// =====================================================
// MAIN APP
// =====================================================

function App() {
  const [me, setMe] = useState(user());
  const [page, setPage] = useState('Dashboard');

  if (!me || !token()) {
    return <Login done={setMe} />;
  }

  function logout() {
    localStorage.clear();
    setMe(null);
  }

  return (
    <div className="app">
      <aside>
        <b>SHMS</b>

        <span>
          {me.name}
          <br />
          {me.role}
        </span>

        {[
          'Dashboard',
          'Patients',
          'Appointments',
          'Billing',
          'AI Assistant',
        ].map((item) => (
          <button
            key={item}
            onClick={() => setPage(item)}
          >
            {item}
          </button>
        ))}

        <button onClick={logout}>Logout</button>
      </aside>

      <main>
  {page === 'Dashboard' && <Dash />}

  {page === 'Patients' && <Patients />}

  {page === 'Appointments' && <Appointments />}

  {page === 'Billing' && <Billing />}

  {page === 'AI Assistant' && <AI />}
</main>
    </div>
  );
}

// =====================================================
// DASHBOARD
// =====================================================

function Dash() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/dashboard/summary').then(setData);
  }, []);

  return (
    <>
      <h2>Dashboard</h2>

      {data ? (
        <div className="cards">
          <i>
            <b>{data.patients}</b>
            Patients
          </i>

          <i>
            <b>{data.doctors}</b>
            Doctors
          </i>

          <i>
            <b>{data.appointments}</b>
            Appointments
          </i>

          <i>
            <b>
              ₱{Number(data.unpaidAmount).toFixed(2)}
            </b>
            Unpaid
          </i>
        </div>
      ) : (
        <p>Loading...</p>
      )}

      <section>
        <h3>System modules</h3>

        <p>
          Patient records • Doctor schedules • Appointments •
          Medical records • Prescriptions • Billing • Payments •
          AI database assistant
        </p>
      </section>
    </>
  );
}

// =====================================================
// PATIENTS
// =====================================================

function Patients() {
  const [rows, setRows] = useState([]);

  const [form, setForm] = useState({
    patient_code: '',
    full_name: '',
    birth_date: '',
    sex: '',
    contact_number: '',
    address: '',
  });

  const [message, setMessage] = useState('');

  const load = () => {
    api('/patients')
      .then(setRows)
      .catch((error) => setMessage(error.message));
  };

  useEffect(load, []);

  async function addPatient(event) {
    event.preventDefault();

    try {
      await api('/patients', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setForm({
        patient_code: '',
        full_name: '',
        birth_date: '',
        sex: '',
        contact_number: '',
        address: '',
      });

      setMessage('Added');

      load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deletePatient(id) {
    if (confirm('Delete patient?')) {
      try {
        await api('/patients/' + id, {
          method: 'DELETE',
        });

        load();
      } catch (error) {
        setMessage(error.message);
      }
    }
  }

  return (
    <>
      <h2>Patients</h2>

      <form className="form" onSubmit={addPatient}>
        {Object.keys(form).map((key) => (
          <input
            key={key}
            type={
              key === 'birth_date'
                ? 'date'
                : 'text'
            }
            placeholder={key}
            value={form[key]}
            onChange={(e) =>
              setForm({
                ...form,
                [key]: e.target.value,
              })
            }
            required={
              key === 'patient_code' ||
              key === 'full_name'
            }
          />
        ))}

        <button>Add Patient</button>
      </form>

      <p>{message}</p>

      <Table
        rows={rows}
        del={deletePatient}
      />
    </>
  );
}

// =====================================================
// TABLE
// =====================================================

function Table({ rows, del }) {
  return (
    <section>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Code</th>
            <th>Name</th>
            <th>Birth</th>

            {del && <th>Action</th>}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.patient_id}>
              <td>{row.patient_id}</td>

              <td>{row.patient_code}</td>

              <td>{row.full_name}</td>

              <td>
                {String(row.birth_date || '').slice(
                  0,
                  10
                )}
              </td>

              {del && (
                <td>
                  <button
                    onClick={() =>
                      del(row.patient_id)
                    }
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// =====================================================
// GENERIC LIST
// =====================================================

function List({ path, title }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api(path)
      .then(setRows)
      .catch(() => {});
  }, [path]);

  return (
    <>
      <h2>{title}</h2>

      <section>
        <table>
          <thead>
            <tr>
              {rows[0] &&
                Object.keys(rows[0])
                  .slice(0, 6)
                  .map((key) => (
                    <th key={key}>{key}</th>
                  ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {Object.keys(row)
                  .slice(0, 6)
                  .map((key) => (
                    <td key={key}>
                      {String(row[key] ?? '')}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

// =====================================================
// AI DATABASE ASSISTANT
// =====================================================

function AI() {
  const [intent, setIntent] = useState(
    'patient_appointment_count'
  );

  const [patientCode, setPatientCode] =
    useState('P-001');

  const [status, setStatus] =
    useState('Confirmed');

  const [result, setResult] = useState(null);

  async function run() {
    const body = {
      intent,
    };

    if (intent === 'patient_appointment_count') {
      body.patientCode = patientCode;
    }

    if (intent === 'appointments_by_status') {
      body.status = status;
    }

    setResult(
      await api('/ai/query', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    );
  }

  return (
    <>
      <h2>AI Database Assistant</h2>

      <section>
        <p>
          This safe demo maps approved questions to
          fixed read-only parameterized SQL. It does
          not execute arbitrary generated SQL.
        </p>

        <select
          value={intent}
          onChange={(e) =>
            setIntent(e.target.value)
          }
        >
          <option value="patient_appointment_count">
            Patient appointment count
          </option>

          <option value="appointments_by_status">
            Appointments by status
          </option>

          <option value="unpaid_invoices">
            Unpaid invoices
          </option>
        </select>

        {intent === 'patient_appointment_count' && (
          <input
            value={patientCode}
            onChange={(e) =>
              setPatientCode(e.target.value)
            }
            placeholder="Patient code"
          />
        )}

        {intent === 'appointments_by_status' && (
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value)
            }
          >
            <option>Pending</option>
            <option>Confirmed</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        )}

        <button onClick={run}>Run</button>

        {result && (
          <pre>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </>
  );
}

// =====================================================
// RENDER APP
// =====================================================

createRoot(
  document.getElementById('root')
).render(<App />);