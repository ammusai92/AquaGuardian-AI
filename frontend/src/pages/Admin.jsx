import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

function PondOpts() {
  const [ps, setPs] = useState([]);
  useEffect(() => { api.get('/api/ponds').then(setPs).catch(() => {}); }, []);
  return <>{ps.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</>;
}

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('params');
  const [params, setParams] = useState([]); const [species, setSpecies] = useState([]);
  const [users, setUsers] = useState([]); const [devices, setDevices] = useState([]);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [np, setNp] = useState({ name: '', unit: '', minExpected: '', maxExpected: '' });
  const [ns, setNs] = useState('');
  const [nu, setNu] = useState({ email: '', name: '', password: '', role: 'RESEARCHER' });
  const [nd, setNd] = useState({ name: 'ESP32-01', pondId: '' });

  const load = () => {
    api.get('/api/parameters').then(setParams).catch(() => {});
    api.get('/api/species').then(setSpecies).catch(() => {});
    if (user.role === 'ADMIN') {
      api.get('/api/auth/users').then(setUsers).catch(() => {});
      api.get('/api/devices').then(setDevices).catch(() => {});
    }
  };
  useEffect(load, []); // eslint-disable-line

  const act = async (fn, ok) => {
    setErr(''); setMsg('');
    try { await fn(); setMsg(ok); load(); } catch (e) { setErr(e.message); }
  };

  const TABS = [['params', 'Measurement Parameters'], ['species', 'Species'],
    ...(user.role === 'ADMIN' ? [['users', 'Users'], ['devices', 'Devices'], ['demo', 'Demo Data']] : [])];

  return (
    <div>
      <div className="topbar"><h2>Administration</h2></div>
      <div className="row" style={{ marginBottom: 12 }}>
        {TABS.map(([k, l]) => (
          <button key={k} className={`btn ghost small ${tab === k ? 'btn' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {err && <div className="err">{err}</div>}{msg && <div className="msg">{msg}</div>}

      {tab === 'params' && (
        <div className="card"><h3>Measurement Parameters (extensible — add anytime, no rebuild)</h3>
          <div className="grid g2">
            <div className="field"><label>Name</label>
              <input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></div>
            <div className="field"><label>Unit</label>
              <input value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value })} /></div>
            <div className="field"><label>Min expected (optional)</label>
              <input type="number" value={np.minExpected} onChange={(e) => setNp({ ...np, minExpected: e.target.value })} /></div>
            <div className="field"><label>Max expected (optional)</label>
              <input type="number" value={np.maxExpected} onChange={(e) => setNp({ ...np, maxExpected: e.target.value })} /></div>
          </div>
          <button className="btn" onClick={() => act(() => api.post('/api/parameters', { ...np,
            minExpected: np.minExpected || null, maxExpected: np.maxExpected || null, enabled: true }),
            'Parameter added — it now appears in all measurement forms.')}>Add parameter</button>
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>Name</th><th>Unit</th><th>Range</th><th>Enabled</th><th></th></tr></thead>
            <tbody>{params.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.unit || ''}</td>
                <td>{p.minExpected ?? ''} – {p.maxExpected ?? ''}</td>
                <td><input type="checkbox" checked={p.enabled}
                  onChange={(e) => act(() => api.put(`/api/parameters/${p.id}`, { enabled: e.target.checked }), 'Updated')} /></td>
                <td><button className="btn danger small"
                  onClick={() => window.confirm(`Delete parameter ${p.name}?`) && act(() => api.del(`/api/parameters/${p.id}?confirm=1`), 'Deleted')}>Del</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'species' && (
        <div className="card"><h3>Species (editable, not hard-coded)</h3>
          <div className="row">
            <input style={{ maxWidth: 250 }} value={ns} onChange={(e) => setNs(e.target.value)} placeholder="e.g. Pangasius" />
            <button className="btn" onClick={() => act(() => api.post('/api/species', { name: ns }), 'Species added')}>Add</button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            {species.map((s) => (
              <span key={s.id} className="badge demo">{s.name}
                <button className="btn danger small" style={{ marginLeft: 6 }}
                  onClick={() => window.confirm(`Delete ${s.name}?`) && act(() => api.del(`/api/species/${s.id}?confirm=1`), 'Deleted')}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card"><h3>Users & Roles (ADMIN / RESEARCHER / FARMER / VIEWER)</h3>
          <div className="grid g2">
            <div className="field"><label>Email</label>
              <input value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></div>
            <div className="field"><label>Name</label>
              <input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></div>
            <div className="field"><label>Password</label>
              <input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></div>
            <div className="field"><label>Role</label>
              <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
                {['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER'].map((r) => <option key={r}>{r}</option>)}
              </select></div>
          </div>
          <button className="btn" onClick={() => act(() => api.post('/api/auth/users', nu), 'User created')}>Create user</button>
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>Email</th><th>Name</th><th>Role</th></tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td><td>{u.name}</td>
                <td><select value={u.role}
                  onChange={(e) => act(() => api.put(`/api/auth/users/${u.id}`, { role: e.target.value }), 'Role updated')}>
                  {['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER'].map((r) => <option key={r}>{r}</option>)}
                </select></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'devices' && (
        <div className="card"><h3>Devices (ESP32)</h3>
          <div className="row">
            <input style={{ maxWidth: 200 }} value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} />
            <select style={{ maxWidth: 250 }} value={nd.pondId} onChange={(e) => setNd({ ...nd, pondId: e.target.value })}>
              <option value="">(no pond linked)</option><PondOpts />
            </select>
            <button className="btn" onClick={() => act(async () => {
              const d = await api.post('/api/devices', nd);
              setMsg(`Device created. API KEY (give to ESP32): ${d.apiKey}`);
            }, '')}>Register device</button>
          </div>
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>Name</th><th>API Key</th><th>Status</th><th>Last heartbeat</th></tr></thead>
            <tbody>{devices.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td><td className="muted">{d.apiKey}</td>
                <td>{d.status}</td>
                <td>{d.lastHeartbeat ? new Date(d.lastHeartbeat).toLocaleString() : 'never'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'demo' && (
        <div className="card"><h3>Demo Data</h3>
          <div className="muted" style={{ marginBottom: 10 }}>
            Demo records are flagged <span className="badge demo">DEMO</span> and hidden from normal views.
            Clearing demo data NEVER touches your real research data.
          </div>
          <button className="btn ghost" onClick={() => act(() => api.post('/api/demo-data'), 'Demo data re-seeded')}>Re-seed demo data</button>{' '}
          <button className="btn danger" onClick={() =>
            window.confirm('Delete ALL demo records? Real data is not affected.') &&
            act(() => api.del('/api/demo-data'), 'Demo data cleared')}>Clear Demo Data</button>
        </div>
      )}
    </div>
  );
}