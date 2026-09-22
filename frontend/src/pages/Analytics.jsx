import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { api } from '../api';

export default function Analytics() {
  const [ponds, setPonds] = useState([]);
  const [pondId, setPondId] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [d, setD] = useState(null); const [err, setErr] = useState('');

  useEffect(() => { api.get('/api/ponds').then(setPonds).catch(() => {}); }, []);
  const run = async () => {
    setErr(''); setD(null);
    try { setD(await api.get(`/api/analytics?pondId=${pondId}&from=${from}&to=${to}`)); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="topbar"><h2>Research Analytics</h2></div>
      <div className="card">
        <div className="filters">
          <select value={pondId} onChange={(e) => setPondId(e.target.value)}>
            <option value="">— select pond —</option>
            {ponds.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" disabled={!pondId} onClick={run}>Analyze</button>
        </div>
        {err && <div className="err">{err}</div>}
        {d && (
          <>
            <h3>Potential relationships</h3>
            <table className="tbl">
              <thead><tr><th>Relationship</th><th>Matched samples (n)</th><th>Pearson r</th><th>Status</th></tr></thead>
              <tbody>
                {d.pairs.map((p) => (
                  <tr key={p.label}>
                    <td>{p.label}</td><td>{p.n}</td><td>{p.r ?? '—'}</td>
                    <td>{p.r === null
                      ? <span className="badge QUESTIONABLE">Insufficient data for reliable analysis</span>
                      : <span className="badge GOOD">Computed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="muted" style={{ margin: '8px 0' }}>
              {d.note} Correlations are computed ONLY from matched real records (minimum 8 pairs). Nothing is fabricated.
            </div>
            <h3>Trends</h3>
            <div className="grid g2">
              {Object.entries(d.trends).map(([name, series], i) => (
                <div key={name}>
                  <div className="muted">{name}</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={series}>
                      <CartesianGrid stroke="#1f2c47" />
                      <XAxis dataKey="d" tick={{ fontSize: 9, fill: '#8ea0b8' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#8ea0b8' }} domain={['auto', 'auto']} /><Tooltip />
                      <Line type="monotone" dataKey="v" stroke={['#14b8a6', '#3b82f6', '#f59e0b'][i % 3]} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
              {Object.keys(d.trends).length === 0 && <div className="muted">No measurement data in range.</div>}
            </div>
          </>
        )}
        {!d && !err && <div className="muted">Select a pond and date range, then Analyze.</div>}
      </div>
    </div>
  );
}