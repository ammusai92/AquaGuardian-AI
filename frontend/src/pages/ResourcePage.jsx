import React, { useEffect, useState } from 'react';
import Form from '../components/Form';
import ImportCSV from '../components/ImportCSV';
import { RESOURCES } from '../config/forms';
import { api } from '../api';
import { useAuth } from '../auth';

export default function ResourcePage({ name }) {
  const cfg = RESOURCES[name];
  const { user } = useAuth();
  const canWrite = user && user.role !== 'VIEWER';
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({});
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [ponds, setPonds] = useState([]);
  const [dynParams, setDynParams] = useState([]);

  useEffect(() => {
    api.get('/api/ponds').then(setPonds).catch(() => {});
    api.get('/api/parameters').then(setDynParams).catch(() => {});
  }, []);

  const qs = () => new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null)
  ).toString();

  const load = async () => {
    setErr('');
    try { setRows(await api.get(`${cfg.endpoint}?${qs()}`)); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [filters]); // eslint-disable-line

  const rowToForm = (r) => {
    if (cfg.rowToForm) return cfg.rowToForm(r);
    const v = { ...r };
    if (r.recordedAt) { v.date = r.recordedAt.slice(0, 10); v.time = r.recordedAt.slice(11, 16); }
    for (const f of cfg.fields) if (f.type === 'date' && v[f.name]) v[f.name] = String(v[f.name]).slice(0, 10);
    delete v.pond; delete v.species; delete v.parameter; delete v.createdById;
    return v;
  };

  const save = async (vals) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = cfg.toBody ? cfg.toBody({ ...vals }) : { ...vals };
      const photoFile = body.__photo;
      delete body.__photo;
      let saved;
      if (editing === 'new') {
        saved = await api.postQueued(cfg.endpoint, body);
        if (saved && saved.queued) {
          setMsg('Saved OFFLINE — will sync automatically when internet returns ✔');
          setEditing(null); return;
        }
      } else {
        saved = await api.put(`${cfg.endpoint}/${editing.id}`, body);
      }
      if (photoFile && saved && saved.id) {
        try {
          const fd = new FormData();
          fd.append('file', photoFile);
          fd.append('refType', name);
          fd.append('refId', saved.id);
          if (vals.pondId) fd.append('pondId', vals.pondId);
          await api.post('/api/photos', fd);
        } catch (_) { /* record saved; photo failed */ }
      }
      setEditing(null); setMsg('Saved ✔'); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (row) => {
    if (!window.confirm('Delete this record permanently? (A copy is kept in the audit log.)')) return;
    try { await api.del(`${cfg.endpoint}/${row.id}?confirm=1`); await load(); }
    catch (e) { setErr(e.message); }
  };

  const fields = cfg.photo && editing
    ? [...cfg.fields, { name: '__photo', label: 'Photo (optional)', type: 'file' }]
    : cfg.fields;

  return (
    <div>
      <div className="topbar">
        <h2>{cfg.title}</h2>
        <div className="row">
          <label className="muted row" style={{ gap: 4 }}>
            <input type="checkbox" style={{ width: 16 }} checked={filters.demo === '1'}
              onChange={(e) => setFilters((f) => ({ ...f, demo: e.target.checked ? '1' : '' }))} />
            Show demo data
          </label>
          {canWrite && <button className="btn" onClick={() => { setMsg(''); setEditing('new'); }}>+ Add</button>}
          {name !== 'ponds' && (
            <button className="btn ghost" onClick={() => api.download(`/api/export/${name}?${qs()}`, `${name}.csv`)}>
              Export CSV
            </button>
          )}
          {canWrite && name !== 'ponds' && (
            <button className="btn ghost" onClick={() => setShowImport(!showImport)}>Import CSV</button>
          )}
        </div>
      </div>
      {cfg.note && <div className="card muted">{cfg.note}</div>}
      {err && <div className="err">{err}</div>}
      {msg && <div className="msg">{msg}</div>}

      {showImport && canWrite && (
        <div className="card"><h3>Import CSV (preview & validate first)</h3>
          <ImportCSV endpoint={name}
            nums={['value', 'amount', 'rawSignal', 'activityIndex', 'feedGiven', 'remainingFeed',
              'airTemp', 'aeratorCount', 'aeratorRuntimeMin', 'mortalityCount',
              'doBefore', 'phBefore', 'tempBefore', 'durationMin', 'durationSec', 'observationMin']} />
        </div>
      )}

      <div className="card">
        <div className="filters">
          <select value={filters.pondId || ''} onChange={(e) => setFilters((f) => ({ ...f, pondId: e.target.value }))}>
            <option value="">All ponds</option>
            {ponds.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          <input type="date" value={filters.from || ''} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <input type="date" value={filters.to || ''} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          {(cfg.filters || []).map((f) => {
            const opts = f.dyn === 'parameters'
              ? dynParams.map((p) => ({ v: p.id, l: p.name }))
              : (f.options || []).map((o) => (typeof o === 'string' ? { v: o, l: o.replaceAll('_', ' ') } : o));
            return (
              <select key={f.k} value={filters[f.k] || ''}
                onChange={(e) => setFilters((s) => ({ ...s, [f.k]: e.target.value }))}>
                <option value="">All {f.label}</option>
                {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            );
          })}
          <input placeholder="Search…" value={filters.q || ''}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} style={{ minWidth: 140 }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr>{cfg.cols.map(([l]) => <th key={l}>{l}</th>)}<th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {cfg.cols.map(([l, get]) => (
                    <td key={l}>{typeof get === 'function' ? get(r) : String(r[get] ?? '')}</td>
                  ))}
                  <td>
                    {r.isDemo && <span className="badge demo">DEMO</span>}{' '}
                    {canWrite && <button className="btn ghost small" onClick={() => { setMsg(''); setEditing(r); }}>Edit</button>}{' '}
                    {canWrite && <button className="btn danger small" onClick={() => remove(r)}>Del</button>}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={cfg.cols.length + 1} className="muted">
                  No records yet — click "+ Add" to enter your first real field data.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="card">
            <h3>{editing === 'new' ? `New — ${cfg.title}` : 'Edit record'}</h3>
            <Form fields={fields} initial={editing === 'new' ? {} : rowToForm(editing)} onSubmit={save} busy={busy} />
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setEditing(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}