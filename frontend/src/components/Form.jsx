import React, { useEffect, useState } from 'react';
import { api } from '../api';

const cache = {};
function useOptions(key) {
  const [opts, setOpts] = useState(cache[key] || []);
  useEffect(() => {
    if (!key || cache[key]) return;
    const url = { ponds: '/api/ponds', species: '/api/species', parameters: '/api/parameters?enabled=true' }[key];
    if (!url) return;
    api.get(url).then((rows) => { cache[key] = rows; setOpts(rows); }).catch(() => {});
  }, [key]);
  return opts;
}

export default function Form({ fields, initial, onSubmit, busy }) {
  const [vals, setVals] = useState(initial || {});
  const ponds = useOptions('ponds');
  const species = useOptions('species');
  const params = useOptions('parameters');

  useEffect(() => { setVals(initial || {}); }, [initial && initial.id]);

  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));

  const options = (key) => {
    if (key === 'ponds') return ponds.map((p) => ({ v: p.id, l: `${p.code} — ${p.name}` }));
    if (key === 'species') return species.map((s) => ({ v: s.id, l: s.name }));
    if (key === 'parameters') return params.map((p) => ({ v: p.id, l: p.unit ? `${p.name} (${p.unit})` : p.name }));
    return (key || []).map((o) => (typeof o === 'string' ? { v: o, l: o.replaceAll('_', ' ') } : o));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(vals); }}>
      <div className="grid g2">
        {fields.map((f) => (
          <div className="field" key={f.name} style={f.full ? { gridColumn: '1 / -1' } : null}>
            <label>{f.label}{f.required && ' *'}{f.hint && <span className="muted"> — {f.hint}</span>}</label>
            {f.type === 'select' ? (
              <select required={f.required} value={vals[f.name] ?? ''}
                onChange={(e) => set(f.name, e.target.value)}>
                <option value="">— select —</option>
                {options(f.options).map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea value={vals[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
            ) : f.type === 'checkbox' ? (
              <input type="checkbox" checked={!!vals[f.name]}
                onChange={(e) => set(f.name, e.target.checked)} style={{ width: 20, height: 20 }} />
            ) : f.type === 'file' ? (
              <input type="file" accept="image/*" capture="environment"
                onChange={(e) => set(f.name, e.target.files[0] || null)} />
            ) : (
              <input type={f.type || 'text'} step={f.step || 'any'} required={f.required}
                value={vals[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
    </form>
  );
}