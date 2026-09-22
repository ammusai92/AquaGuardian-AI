import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { api } from '../api';

// Client-side preview + validation BEFORE anything is imported
export default function ImportCSV({ endpoint, nums = [] }) {
  const [parsed, setParsed] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  const onFile = (file) => {
    setErr(''); setResult(null);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        const rows = data.map((r0) => {
          const r = {};
          for (const k in r0) r[k.trim()] = typeof r0[k] === 'string' ? r0[k].trim() : r0[k];
          return r;
        });
        // resolve pond CODE -> pondId, and parameter NAME -> parameterId
        try {
          const ponds = await api.get('/api/ponds');
          const pmap = Object.fromEntries(ponds.map((p) => [p.code, p.id]));
          let paramMap = {};
          if (rows.some((r) => r.parameter !== undefined)) {
            const ps = await api.get('/api/parameters');
            paramMap = Object.fromEntries(ps.map((p) => [p.name, p.id]));
          }
          rows.forEach((r) => {
            if (!r.pondId && r.pond && pmap[r.pond]) r.pondId = pmap[r.pond];
            if (!r.parameterId && r.parameter && paramMap[r.parameter]) r.parameterId = paramMap[r.parameter];
          });
        } catch (_) { /* offline — server will validate */ }

        const problems = [];
        rows.forEach((r, i) => {
          if (!r.pondId && r.pond === undefined) problems.push(`row ${i + 1}: missing pond (need pondId or pond code column)`);
          nums.forEach((k) => { if (r[k] && isNaN(Number(r[k]))) problems.push(`row ${i + 1}: ${k} is not a number`); });
          if (r.date && isNaN(Date.parse(r.date))) problems.push(`row ${i + 1}: date is invalid`);
        });
        setParsed({ rows, problems });
      },
    });
  };

  const doImport = async () => {
    const good = parsed.rows.filter((_, i) => !parsed.problems.some((p) => p.startsWith(`row ${i + 1}:`)));
    try {
      setResult(await api.post(`/api/import/${endpoint}`, { rows: good }));
      setParsed(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv,text/csv"
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <div className="muted" style={{ margin: '6px 0' }}>
        Tip: click <b>Export CSV</b> first to see the exact column format, then fill your rows to match it.
        The <b>pond</b> column should use the pond code (e.g. P-01); it is converted automatically.
      </div>
      {err && <div className="err">{err}</div>}
      {parsed && (
        <div>
          <div className="muted">{parsed.rows.length} rows parsed, {parsed.problems.length} problem(s) found</div>
          {parsed.problems.slice(0, 8).map((p) => <div className="err" key={p}>{p}</div>)}
          <table className="tbl"><tbody>
            {parsed.rows.slice(0, 4).map((r, i) => (
              <tr key={i}><td>{JSON.stringify(r).slice(0, 180)}</td></tr>
            ))}
          </tbody></table>
          <button className="btn" onClick={doImport}
            disabled={parsed.rows.length === parsed.problems.length}>
            Import valid rows
          </button>
        </div>
      )}
      {result && (
        <div className="msg">
          Imported {result.imported}, failed {result.failed}.
          {result.errors?.length ? ' ' + result.errors.map((e) => `row ${e.row}: ${e.error}`).join('; ') : ''}
        </div>
      )}
    </div>
  );
}