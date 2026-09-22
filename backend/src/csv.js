// Minimal RFC-4180 CSV serializer (no extra dependency)
function toCSV(rows, fields) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = fields.join(',');
  const body = rows.map((r) => fields.map((f) => esc(r[f])).join(',')).join('\n');
  return head + '\n' + body;
}

module.exports = { toCSV };