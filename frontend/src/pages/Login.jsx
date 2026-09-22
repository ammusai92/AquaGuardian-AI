import React, { useState } from 'react';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ width: 340 }}>
        <h3>AquaGuardian AI — Research Login</h3>
        {err && <div className="err">{err}</div>}
        <div className="field"><label>Email</label>
          <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>Password</label>
          <input type="password" value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn" style={{ width: '100%' }} onClick={async () => {
          try { await login(f.email, f.password); } catch (e) { setErr(e.message); }
        }}>Sign in</button>
      </div>
    </div>
  );
}