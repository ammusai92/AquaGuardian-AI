import React, { useEffect, useState } from 'react';
import { api } from '../api';

const FEATURES = [
  ['do', 'DO'], ['ph', 'pH'], ['temperature', 'Temperature'], ['activityIndex', 'Activity Index'],
  ['activityLevel', 'Activity Level (observed)'], ['prevFeedAmount', 'Previous Feed Amount'],
  ['timeOfDay', 'Time of Day'], ['weather', 'Weather'], ['rainfall', 'Rainfall'],
  ['aeratorStatus', 'Aerator Status'], ['trayConsumption', 'Feed Tray Consumption'],
];
const TARGETS = [['feedingResponse', 'Feeding Response'], ['consumption', 'Observed Feed Consumption']];
const LABEL_VALUES = ['POSITIVE_FEEDING_RESPONSE', 'NEGATIVE_FEEDING_RESPONSE', 'UNCERTAIN'];
const STATUSES = ['UNLABELED', 'LABELED', 'NEEDS_REVIEW'];

export default function MlLabels() {
  const [feats, setFeats] = useState(['do', 'ph', 'temperature', 'activityIndex']);
  const [target, setTarget] = useState('feedingResponse');
  const [ponds, setPonds] = useState([]); const [pondId, setPondId] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [out, setOut] = useState(null); const [labels, setLabels] = useState([]);
  const [err, setErr] = useState('');

  const loadLabels = () => api.get('/api/labels').then(setLabels).catch(() => {});
  useEffect(() => { api.get('/api/ponds').then(setPonds).catch(() => {}); loadLabels(); }, []);

  const build = async () => {
    setErr(''); setOut(null);
    try {
      const d = await api.post('/api/ml/dataset', { features: feats, target,
        pondId: pondId || undefined, from: from || undefined, to: to || undefined });
      setOut(d);
      if (d.csv) {
        const blob = new Blob([d.csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `aquaguardian-dataset-${Date.now()}.csv`; a.click();
      }
    } catch (e) { setErr(e.message); }
  };

  const genLabels = async () => {
    try {
      const r = await api.post('/api/labels/generate', { pondId: pondId || undefined, from: from || undefined, to: to || undefined });
      alert(`Created ${r.created} candidate labels from ${r.candidates} feeding events.`);
      loadLabels();
    } catch (e) { setErr(e.message); }
  };
  const setLabel = async (id, patch) => { await api.put(`/api/labels/${id}`, patch); loadLabels(); };

  return (
    <div>
      <div className="topbar"><h2>ML Dataset Builder & Data Labeling</h2></div>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <h3>Build training dataset (CSV download)</h3>
        <div className="row" style={{ marginBottom: 10 }}>
          {FEATURES.map(([k, l]) => (
            <label key={k} className="muted row" style={{ gap: 4, minWidth: 150 }}>
              <input type="checkbox" style={{ width: 16 }} checked={feats.includes(k)}
                onChange={(e) => setFeats((s) => e.target.checked ? [...s, k] : s.filter((x) => x !== k))} /> {l}
            </label>
          ))}
        </div>
        <div className="grid g2">
          <div className="field"><label>Target variable (choose later — not hard-coded)</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>
          <div className="field"><label>Pond (optional)</label>
            <select value={pondId} onChange={(e) => setPondId(e.target.value)}>
              <option value="">All ponds</option>
              {ponds.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select></div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        </div>
        <button className="btn" onClick={build}>Build & Download CSV</button>{' '}
        <button className="btn ghost" onClick={genLabels}>Generate candidate labels from feeding events</button>
        {out && <div className="msg">{out.count} samples{out.message ? ` — ${out.message}` : ' — CSV downloaded.'} Rows with UNKNOWN target are excluded.</div>}
      </div>

      <div className="card">
        <h3>Labels — {STATUSES.map((s) => `${s.replace('_', ' ')}: ${labels.filter((l) => l.status === s).length}`).join('  ·  ')}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Pond</th><th>Summary</th><th>Label</th><th>Status</th></tr></thead>
            <tbody>
              {labels.slice(0, 100).map((l) => (
                <tr key={l.id}>
                  <td>{(l.recordedAt || '').slice(0, 16).replace('T', ' ')}</td>
                  <td>{l.pond?.code || ''}</td>
                  <td>{l.summary}</td>
                  <td><select value={l.labelValue || ''}
                    onChange={(e) => setLabel(l.id, { labelValue: e.target.value, status: 'LABELED' })}>
                    <option value="">—</option>{LABEL_VALUES.map((v) => <option key={v}>{v}</option>)}
                  </select></td>
                  <td><select value={l.status} onChange={(e) => setLabel(l.id, { status: e.target.value })}>
                    {STATUSES.map((v) => <option key={v}>{v}</option>)}
                  </select></td>
                </tr>
              ))}
              {!labels.length && <tr><td colSpan={5} className="muted">No labels yet — generate candidates from your feeding events.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Labels can be changed later. Only you decide what POSITIVE FEEDING RESPONSE means for your study.</div>
      </div>
    </div>
  );
}