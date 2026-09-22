import React, { useEffect, useState } from 'react';
import { api, pendingCount } from '../api';

const LEVELS = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
const RESPONSES = ['STRONG', 'MODERATE', 'WEAK', 'NONE', 'UNKNOWN'];
const WEATHER = ['Sunny', 'Cloudy', 'Rainy', 'Overcast', 'Windy'];

export default function QuickEntry() {
  const [ponds, setPonds] = useState([]);
  const [params, setParams] = useState([]);
  const [f, setF] = useState({
    pondId: '', date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    do: '', ph: '', temp: '', activityLevel: '',
    amount: '', unit: 'kg', response: '', weather: '', notes: '',
  });
  const [status, setStatus] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    api.get('/api/ponds').then(setPonds).catch(() => {});
    api.get('/api/parameters?enabled=true').then(setParams).catch(() => {});
  }, []);

  const save = async () => {
    setStatus('Saving…');
    try {
      const base = { pondId: f.pondId, date: f.date, time: f.time, notes: f.notes };
      for (const [pname, val] of [['Dissolved Oxygen', f.do], ['pH', f.ph], ['Temperature', f.temp]]) {
        if (val === '') continue;
        const p = params.find((x) => x.name === pname);
        if (p) await api.postQueued('/api/measurements', { ...base, parameterId: p.id, value: Number(val), method: 'Manual Observation' });
      }
      if (f.activityLevel) await api.postQueued('/api/activity', { ...base, activityLevel: f.activityLevel, weather: f.weather });
      if (f.amount) await api.postQueued('/api/feeding', { ...base, amount: Number(f.amount), unit: f.unit,
        response: f.response || undefined, weather: f.weather, feedType: 'Commercial pellet' });
      const pend = pendingCount();
      setStatus(`Saved ✔${pend ? ` — ${pend} record(s) waiting to sync` : ''}`);
      setF((s) => ({ ...s, do: '', ph: '', temp: '', activityLevel: '', amount: '', response: '', notes: '' }));
      setTimeout(() => setStatus(''), 5000);
    } catch (e) { setStatus(''); alert(e.message); }
  };

  return (
    <div>
      <div className="topbar"><h2>Quick Field Entry</h2>
        {pendingCount() > 0 && <span className="sync pending">PENDING SYNC: {pendingCount()}</span>}</div>
      <div className="card">
        <div className="grid g2">
          <div className="field"><label>Pond *</label>
            <select value={f.pondId} onChange={(e) => set('pondId', e.target.value)}>
              <option value="">— select pond —</option>
              {ponds.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select></div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Date</label>
              <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>Time</label>
              <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></div>
          </div>
          <div className="field"><label>DO (mg/L)</label>
            <input type="number" step="0.1" inputMode="decimal" value={f.do} onChange={(e) => set('do', e.target.value)} /></div>
          <div className="field"><label>pH</label>
            <input type="number" step="0.1" inputMode="decimal" value={f.ph} onChange={(e) => set('ph', e.target.value)} /></div>
          <div className="field"><label>Temperature (°C)</label>
            <input type="number" step="0.1" inputMode="decimal" value={f.temp} onChange={(e) => set('temp', e.target.value)} /></div>
          <div className="field"><label>Activity Level</label>
            <select value={f.activityLevel} onChange={(e) => set('activityLevel', e.target.value)}>
              <option value="">— not recorded —</option>
              {LEVELS.map((v) => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}
            </select></div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Feed Amount</label>
              <input type="number" step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></div>
            <div className="field" style={{ width: 90 }}><label>Unit</label>
              <select value={f.unit} onChange={(e) => set('unit', e.target.value)}><option>kg</option><option>g</option></select></div>
          </div>
          <div className="field"><label>Feeding Response</label>
            <select value={f.response} onChange={(e) => set('response', e.target.value)}>
              <option value="">— not recorded —</option>
              {RESPONSES.map((v) => <option key={v} value={v}>{v === 'NONE' ? 'NO RESPONSE' : v}</option>)}
            </select></div>
          <div className="field"><label>Weather</label>
            <select value={f.weather} onChange={(e) => set('weather', e.target.value)}>
              <option value="">— not recorded —</option>
              {WEATHER.map((v) => <option key={v}>{v}</option>)}
            </select></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notes</label>
            <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        </div>
        <button className="btn" disabled={!f.pondId} onClick={save} style={{ width: '100%', fontSize: 16, padding: 14 }}>
          Save Field Data
        </button>
        <div className="muted" style={{ marginTop: 6 }}>Blank fields are skipped. Works offline — records queue and sync automatically.</div>
        {status && <div className="msg">{status}</div>}
      </div>
    </div>
  );
}