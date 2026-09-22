import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { api } from '../api';

const COLORS = ['#14b8a6', '#3b82f6', '#f59e0b', '#a78bfa', '#ef4444', '#22c55e'];

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/api/dashboard').then(setD).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="err">Failed to load dashboard: {err}</div>;
  if (!d) return <div className="muted">Loading…</div>;
  const c = d.counts;
  const names = Object.keys(d.series).filter((n) => d.series[n] && d.series[n].length);

  return (
    <div>
      <div className="topbar"><h2>Research Dashboard</h2></div>
      <div className="grid g3">
        {[['Ponds (real)', c.ponds], ['Measurements (real)', c.measurements], ['Feeding records', c.feeding],
          ['Activity observations', c.activity], ['Activity signals', c.signals],
          ['Labelled samples', c.labeled], ['Days of data', c.days]].map(([l, n]) => (
          <div className="kpi" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>
        ))}
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        {names.length === 0 && (
          <div className="card muted">
            No real trend data yet — charts appear here automatically as you collect data.
            (Demo data is hidden by default; toggle "Show demo data" on any page to explore.)
          </div>
        )}
        {names.map((n, i) => (
          <div className="card" key={n}><h3>{n} — daily mean (30 days)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={d.series[n]}>
                <CartesianGrid stroke="#1f2c47" />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#8ea0b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8ea0b8' }} domain={['auto', 'auto']} /><Tooltip />
                <Line type="monotone" dataKey="v" stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
      <div className="grid g2">
        <div className="card">
          <h3>Latest feeding event</h3>
          {d.latest.feeding ? `${d.latest.feeding.pond?.code || ''} — ${d.latest.feeding.amount ?? '?'} ${d.latest.feeding.unit || ''} ${d.latest.feeding.feedType || ''}, response: ${d.latest.feeding.response || '—'}` : 'None yet'}
          <h3 style={{ marginTop: 14 }}>Latest activity observation</h3>
          {d.latest.activity ? `${d.latest.activity.pond?.code || ''} — activity ${d.latest.activity.activityLevel || '—'}` : 'None yet'}
        </div>
        <div className="card">
          <h3>Alerts</h3>
          {d.alerts.length === 0 && <div className="muted">No active alerts.</div>}
          {d.alerts.map((a) => <div key={a.id} className="err">{a.pond?.code ? `[${a.pond.code}] ` : ''}{a.message}</div>)}
        </div>
      </div>
    </div>
  );
}