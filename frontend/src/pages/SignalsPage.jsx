import React, { useEffect, useMemo, useState } from 'react';
import ResourcePage from './ResourcePage';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';

export default function SignalsPage() {
  const [pondId, setPondId] = useState('');
  const [ponds, setPonds] = useState([]);
  const [signals, setSignals] = useState([]);
  const [feedings, setFeedings] = useState([]);
  useEffect(() => { api.get('/api/ponds').then(setPonds).catch(() => {}); }, []);
  useEffect(() => {
    if (!pondId) return;
    api.get(`/api/activity-signals?pondId=${pondId}`).then(setSignals).catch(() => {});
    api.get(`/api/feeding?pondId=${pondId}`).then(setFeedings).catch(() => {});
  }, [pondId]);

  // Experimental validation — does NOT claim the sensor works.
  const comp = useMemo(() => {
    const lvl = { VERY_LOW: 0.1, LOW: 0.3, MEDIUM: 0.5, HIGH: 0.7, VERY_HIGH: 0.9 };
    return signals.filter((s) => s.activityIndex != null).map((s) => {
      const f = feedings.find((x) => Math.abs(new Date(x.recordedAt) - new Date(s.recordedAt)) < 36e5);
      if (!f) return { t: s.recordedAt, index: s.activityIndex, observed: null, status: 'NO PAIRED FEEDING RECORD' };
      const obs = lvl[f.activityBefore || f.activityDuring] ?? null;
      if (obs == null) return { t: s.recordedAt, index: s.activityIndex, observed: null, status: 'UNCERTAIN' };
      const diff = Math.abs(s.activityIndex - obs);
      return { t: s.recordedAt, index: s.activityIndex, observed: obs,
        status: diff < 0.2 ? 'MATCH' : diff < 0.35 ? 'UNCERTAIN' : 'MISMATCH' };
    });
  }, [signals, feedings]);

  const chartData = comp.map((c) => ({ ...c, t: c.t.slice(5, 16).replace('T', ' ') }));

  return (
    <div>
      <ResourcePage name="activity-signals" />
      <div className="card">
        <h3>Activity Signal vs Observed Feeding Behaviour — experimental validation</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          MATCH / UNCERTAIN / MISMATCH are computed against your own observations for research review.
          This does NOT prove the sensor works — that is exactly what this analysis helps you determine.
        </div>
        <select value={pondId} onChange={(e) => setPondId(e.target.value)} style={{ maxWidth: 300 }}>
          <option value="">— select pond to compare —</option>
          {ponds.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        {pondId && chartData.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#1f2c47" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#8ea0b8' }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#8ea0b8' }} /><Tooltip /><Legend />
                <Line type="monotone" dataKey="index" name="Activity Index (sensor)" stroke="#14b8a6" dot />
                <Line type="monotone" dataKey="observed" name="Observed activity (encoded)" stroke="#3b82f6" dot />
              </LineChart>
            </ResponsiveContainer>
            <div className="row">
              {['MATCH', 'UNCERTAIN', 'MISMATCH', 'NO PAIRED FEEDING RECORD'].map((s) => (
                <span key={s} className="muted">{s}: {chartData.filter((c) => c.status === s).length}</span>
              ))}
            </div>
          </>
        )}
        {pondId && chartData.length === 0 && <div className="muted">No activity signals with an Activity Index yet for this pond.</div>}
      </div>
    </div>
  );
}