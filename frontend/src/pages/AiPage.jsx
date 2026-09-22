import React, { useEffect, useState } from 'react';
import { api } from '../api';

const RECS = { FEED: 'ok', REDUCE_FEED: 'warn', DELAY_FEED: 'warn', DO_NOT_FEED: 'bad', MANUAL_CHECK: 'warn' };

export default function AiPage() {
  const [ponds, setPonds] = useState([]);
  const [f, setF] = useState({ pondId: '', do: '', ph: '', temp: '', activityIndex: '', weather: '' });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const loadHistory = () => api.get('/api/ai-decisions?limit=50').then(setHistory).catch(() => {});
  useEffect(() => { api.get('/api/ponds').then(setPonds).catch(() => {}); loadHistory(); }, []);

  const recommend = async () => {
    setErr(''); setResult(null);
    try {
      setResult(await api.post('/api/ai/recommend', { ...f,
        do: f.do || undefined, ph: f.ph || undefined, temp: f.temp || undefined,
        activityIndex: f.activityIndex === '' ? undefined : Number(f.activityIndex) }));
      loadHistory();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="topbar"><h2>AI / ML Feeding Decision (decision support — experimental)</h2></div>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <h3>Get recommendation</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          Safety checks run first and can override ML. Blank DO/pH/temp use the latest stored readings.
          Thresholds are <b>prototype configuration</b>, not universal biological limits.
        </div>
        <div className="grid g2">
          <div className="field"><label>Pond *</label>
            <select value={f.pondId} onChange={(e) => set('pondId', e.target.value)}>
              <option value="">— select —</option>
              {ponds.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select></div>
          <div className="field"><label>Activity Index (0–1, experimental)</label>
            <input type="number" step="0.01" value={f.activityIndex} onChange={(e) => set('activityIndex', e.target.value)} /></div>
          <div className="field"><label>DO (mg/L) — blank = latest</label>
            <input type="number" step="0.1" value={f.do} onChange={(e) => set('do', e.target.value)} /></div>
          <div className="field"><label>pH — blank = latest</label>
            <input type="number" step="0.1" value={f.ph} onChange={(e) => set('ph', e.target.value)} /></div>
          <div className="field"><label>Temperature (°C) — blank = latest</label>
            <input type="number" step="0.1" value={f.temp} onChange={(e) => set('temp', e.target.value)} /></div>
          <div className="field"><label>Weather</label>
            <select value={f.weather} onChange={(e) => set('weather', e.target.value)}>
              <option value="">—</option>{['Sunny', 'Cloudy', 'Rainy', 'Overcast', 'Windy'].map((x) => <option key={x}>{x}</option>)}
            </select></div>
        </div>
        <button className="btn" disabled={!f.pondId} onClick={recommend}>Get ML-based feeding decision</button>
        {result && (
          <div style={{ marginTop: 12 }}>
            <div className="row">
              <span className={`badge ${RECS[result.decision.finalRecommendation] || ''}`} style={{ fontSize: 15, padding: '6px 14px' }}>
                {(result.decision.finalRecommendation || '').replaceAll('_', ' ')}
              </span>
              <span className="muted">safety: {result.safety.status} · model: {result.mlUsed ? 'ML (experimental)' : 'rule-based fallback (untrained)'}</span>
            </div>
            <ul className="muted">
              {result.safety.reasons.concat([result.decision.reason]).filter(Boolean).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="muted">{result.disclaimer}</div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Decision log (AI vs farmer vs observed response)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Pond</th><th>ML rec</th><th>Safety</th><th>Final</th><th>DO</th><th>pH</th><th>Temp</th><th>Act.Idx</th><th>Reason</th></tr></thead>
            <tbody>
              {history.map((d) => (
                <tr key={d.id}>
                  <td>{(d.recordedAt || '').slice(0, 16).replace('T', ' ')}</td>
                  <td>{d.pond?.code}</td>
                  <td>{d.mlRecommendation}</td><td>{d.safetyStatus}</td>
                  <td><span className={`badge ${RECS[d.finalRecommendation] || ''}`}>{d.finalRecommendation}</span></td>
                  <td>{d.doValue ?? ''}</td><td>{d.phValue ?? ''}</td><td>{d.tempValue ?? ''}</td><td>{d.activityIndex ?? ''}</td>
                  <td className="muted">{(d.reason || '').slice(0, 60)}</td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={10} className="muted">No decisions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}