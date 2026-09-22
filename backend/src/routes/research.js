const express = require('express');
const { prisma } = require('../db');
const { requireRole, wrap } = require('../middleware');
const { evaluateSafety, ruleRecommendation } = require('../safety');
const { toCSV } = require('../csv');

const r = express.Router();
const LEVEL_NUM = { VERY_LOW: 0.1, LOW: 0.3, MEDIUM: 0.5, HIGH: 0.7, VERY_HIGH: 0.9 };
const RESP_NUM = { STRONG: 1, MODERATE: 0.66, WEAK: 0.33, NONE: 0, UNKNOWN: null };
const CONS_NUM = { FULL: 1, MOSTLY: 0.75, PARTIAL: 0.5, SIGNIFICANT_REMAINING: 0.25, UNKNOWN: null };
const MIN_N = 8; // minimum matched pairs before any statistic is shown

function pearson(xs, ys) {
  const n = xs.length;
  if (n < MIN_N) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return +(sxy / Math.sqrt(sxx * syy)).toFixed(3);
}

// ---------- DASHBOARD ----------
r.get('/dashboard', requireRole(), wrap(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 864e5);
  const [ponds, measurements, feeding, activity, signals, labeled, alerts, mRows, fRows, sRows] =
    await Promise.all([
      prisma.pond.count({ where: { isDemo: false } }),
      prisma.sensorMeasurement.count({ where: { isDemo: false } }),
      prisma.feedingEvent.count({ where: { isDemo: false } }),
      prisma.activityRecord.count({ where: { isDemo: false } }),
      prisma.activitySignal.count({ where: { isDemo: false } }),
      prisma.mlLabel.count({ where: { status: 'LABELED' } }),
      prisma.alert.findMany({ where: { acknowledged: false }, orderBy: { createdAt: 'desc' }, take: 6, include: { pond: { select: { code: true } } } }),
      prisma.sensorMeasurement.findMany({ where: { isDemo: false, recordedAt: { gte: since } },
        select: { recordedAt: true, value: true, parameter: { select: { name: true } } } }),
      prisma.feedingEvent.findMany({ where: { isDemo: false, recordedAt: { gte: since }, amount: { not: null } },
        select: { recordedAt: true, amount: true } }),
      prisma.activitySignal.findMany({ where: { isDemo: false, recordedAt: { gte: since }, activityIndex: { not: null } },
        select: { recordedAt: true, activityIndex: true } }),
    ]);

  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const series = {};
  const acc = {};
  for (const m of mRows) {
    if (m.value === null) continue;
    const name = m.parameter.name;
    acc[name] = acc[name] || {};
    const k = dayKey(m.recordedAt);
    (acc[name][k] = acc[name][k] || []).push(m.value);
  }
  for (const [name, byDay] of Object.entries(acc))
    series[name] = Object.entries(byDay).sort().map(([d, vs]) => ({ d, v: +(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(2) }));
  series['Feed (kg)'] = Object.entries(fRows.reduce((a, f) => { const k = dayKey(f.recordedAt); a[k] = (a[k] || 0) + f.amount; return a; }, {}))
    .sort().map(([d, v]) => ({ d, v: +v.toFixed(2) }));
  series['Activity Index'] = Object.entries(sRows.reduce((a, s) => { const k = dayKey(s.recordedAt); (a[k] = a[k] || []).push(s.activityIndex); return a; }, {}))
    .sort().map(([d, vs]) => ({ d, v: +(vs.reduce((x, y) => x + y, 0) / vs.length).toFixed(2) }));

  const lastFeeding = await prisma.feedingEvent.findFirst({ where: { isDemo: false }, orderBy: { recordedAt: 'desc' }, include: { pond: { select: { code: true, name: true } } } });
  const lastActivity = await prisma.activityRecord.findFirst({ where: { isDemo: false }, orderBy: { recordedAt: 'desc' }, include: { pond: { select: { code: true, name: true } } } });

  const first = await prisma.sensorMeasurement.findFirst({ where: { isDemo: false }, orderBy: { recordedAt: 'asc' } });
  const days = first ? Math.max(1, Math.ceil((Date.now() - new Date(first.recordedAt)) / 864e5)) : 0;

  res.json({
    counts: { ponds, measurements, feeding, activity, signals, labeled, days },
    series, alerts,
    latest: { feeding: lastFeeding, activity: lastActivity },
  });
}));

// ---------- RESEARCH ANALYTICS (honest: no fabricated correlations) ----------
r.get('/analytics', requireRole(), wrap(async (req, res) => {
  const { pondId, from, to } = req.query;
  if (!pondId) return res.status(400).json({ error: 'pondId required' });
  const where = { pondId, isDemo: false };
  if (from || to) where.recordedAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(`${to}T23:59:59`) }) };

  const [ms, fs, ss, ars] = await Promise.all([
    prisma.sensorMeasurement.findMany({ where, select: { recordedAt: true, value: true, parameter: { select: { name: true } } } }),
    prisma.feedingEvent.findMany({ where, orderBy: { recordedAt: 'asc' } }),
    prisma.activitySignal.findMany({ where: { ...where, activityIndex: { not: null } }, select: { recordedAt: true, activityIndex: true } }),
    prisma.activityRecord.findMany({ where: { ...where, activityLevel: { not: null } }, select: { recordedAt: true, activityLevel: true } }),
  ]);

  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const byDayParam = {};
  for (const m of ms) {
    if (m.value === null) continue;
    const k = dayKey(m.recordedAt);
    (byDayParam[m.parameter.name] = byDayParam[m.parameter.name] || {})[k] = m.value;
  }
  const sigByDay = {}, lvlByDay = {};
  ss.forEach((s) => { sigByDay[dayKey(s.recordedAt)] = s.activityIndex; });
  ars.forEach((a) => { lvlByDay[dayKey(a.recordedAt)] = LEVEL_NUM[a.activityLevel]; });

  const rows = fs.map((f) => ({
    d: dayKey(f.recordedAt),
    response: RESP_NUM[f.response] ?? null,
    consumption: CONS_NUM[f.consumption] ?? null,
    amount: f.amount ?? null,
  }));
  const pairs = [];
  const addPair = (label, getY) => {
    const xs = [], ys = [];
    for (const row of rows) {
      const x = (byDayParam[label.split(' vs')[0]] || {})[row.d] ?? (label.startsWith('Activity') ? (sigByDay[row.d] ?? lvlByDay[row.d]) : undefined);
      const y = getY(row);
      if (x !== undefined && x !== null && y !== null && y !== undefined) { xs.push(+x); ys.push(y); }
    }
    pairs.push({ label, n: xs.length, r: pearson(xs, ys) });
  };
  addPair('Dissolved Oxygen vs Feeding Response', (row) => row.response);
  addPair('pH vs Feeding Response', (row) => row.response);
  addPair('Temperature vs Feeding Response', (row) => row.response);
  addPair('Activity vs Feeding Response', (row) => row.response);
  addPair('Activity vs Feed Amount', (row) => row.amount);
  addPair('Activity vs Feed Consumption', (row) => row.consumption);

  const trends = Object.fromEntries(Object.entries(byDayParam).map(([k, byDay]) => [k, Object.entries(byDay).sort().map(([d, v]) => ({ d, v }))]));
  res.json({ pairs, trends, note: 'Categorical responses encoded ordinally. Correlation does not imply causation. Prototype analysis.' });
}));

// ---------- AI RECOMMENDATION (safety first, ML optional, honest) ----------
r.post('/ai/recommend', requireRole('ADMIN', 'RESEARCHER', 'FARMER'), wrap(async (req, res) => {
  const { pondId, doValue, phValue, tempValue, activityIndex, weather } = req.body || {};
  const pond = await prisma.pond.findUnique({ where: { id: pondId } });
  if (!pond) return res.status(404).json({ error: 'Pond not found' });

  const readings = {};
  if (doValue !== undefined && doValue !== null && doValue !== '') readings['Dissolved Oxygen'] = +doValue;
  if (phValue !== undefined && phValue !== null && phValue !== '') readings['pH'] = +phValue;
  if (tempValue !== undefined && tempValue !== null && tempValue !== '') readings['Temperature'] = +tempValue;

  const safety = await evaluateSafety(pond, Object.keys(readings).length ? readings : null, activityIndex);

  // Try trained ML model if available; otherwise rule-based fallback
  let ml = null;
  try {
    const mlRes = await fetch(`${process.env.ML_URL || 'http://localhost:5001'}/predict`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ do: readings['Dissolved Oxygen'], ph: readings['pH'], temp: readings['Temperature'], activityIndex }),
      signal: AbortSignal.timeout(2500),
    }).then((x) => x.json());
    if (mlRes && mlRes.status === 'TRAINED' && mlRes.recommendation) ml = mlRes;
  } catch (_) { /* ML service optional */ }

  const fallback = ruleRecommendation({ safety, activityIndex });
  const mlRecommendation = ml ? ml.recommendation : fallback.rec;
  let finalRecommendation = ml ? ml.recommendation : fallback.rec;
  let reason = ml ? `ML model (experimental): ${ml.reason || 'model prediction'}` : fallback.reason;

  // SAFETY OVERRIDES ML — always
  if (safety.status === 'OVERRIDE' || safety.status === 'MANUAL_CHECK') {
    finalRecommendation = safety.status === 'OVERRIDE' ? 'DO_NOT_FEED' : 'MANUAL_CHECK';
    reason = `SAFETY OVERRIDE: ${safety.reasons.join(' | ')}`;
  }

  const lastFeed = await prisma.feedingEvent.findFirst({ where: { pondId, isDemo: false }, orderBy: { recordedAt: 'desc' } });
  const decision = await prisma.aiDecision.create({
    data: { pondId, doValue: readings['Dissolved Oxygen'] ?? null, phValue: readings['pH'] ?? null,
            tempValue: readings['Temperature'] ?? null, activityIndex: activityIndex ?? null,
            previousFeedAmount: lastFeed?.amount ?? null, weather: weather || null,
            mlRecommendation, safetyStatus: safety.status, finalRecommendation, reason },
  });
  if (safety.status === 'OVERRIDE')
    await prisma.alert.create({ data: { pondId, type: 'SAFETY', severity: 'WARNING', message: reason } });

  res.json({ decision, safety, mlUsed: !!ml,
    disclaimer: 'ML-based feeding decision support only. Activity sensing is experimental. Thresholds are prototype configuration, not universal biological limits.' });
}));

// ---------- LABELS: generate candidates from feeding events ----------
r.post('/labels/generate', requireRole('ADMIN', 'RESEARCHER'), wrap(async (req, res) => {
  const { pondId, from, to } = req.body || {};
  const where = {
    ...(pondId && { pondId }),
    ...((from || to) && { recordedAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(`${to}T23:59:59`) }) } }),
  };
  const events = await prisma.feedingEvent.findMany({ where, orderBy: { recordedAt: 'desc' }, take: 500 });
  let created = 0;
  for (const f of events) {
    const exists = await prisma.mlLabel.findFirst({ where: { refType: 'FEEDING', refId: f.id } });
    if (exists) continue;
    await prisma.mlLabel.create({ data: {
      pondId: f.pondId, recordedAt: f.recordedAt, refType: 'FEEDING', refId: f.id,
      summary: `${f.amount ?? '?'} ${f.unit || ''} ${f.feedType || ''} -> response ${f.response || 'UNKNOWN'}, consumption ${f.consumption || 'UNKNOWN'}`,
    } });
    created++;
  }
  res.json({ created, candidates: events.length });
}));

// ---------- ML DATASET BUILDER ----------
const FEATURES = ['do', 'ph', 'temperature', 'activityIndex', 'activityLevel', 'prevFeedAmount', 'timeOfDay', 'weather', 'rainfall', 'aeratorStatus', 'trayConsumption'];

r.post('/ml/dataset', requireRole('ADMIN', 'RESEARCHER'), wrap(async (req, res) => {
  const { features, target = 'feedingResponse', pondId, from, to, name } = req.body || {};
  const feats = (features || []).filter((f) => FEATURES.includes(f));
  if (!feats.length) return res.status(400).json({ error: 'Select at least one feature' });
  const where = {
    isDemo: false,
    ...(pondId && { pondId }),
    ...((from || to) && { recordedAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(`${to}T23:59:59`) }) } }),
  };
  const events = await prisma.feedingEvent.findMany({ where, orderBy: { recordedAt: 'asc' }, include: { pond: { select: { code: true } } } });

  const near = async (pid, at, mins) => {
    const rows = await prisma.sensorMeasurement.findMany({
      where: { pondId: pid, recordedAt: { gte: new Date(new Date(at) - mins * 60000), lte: new Date(at) } },
      orderBy: { recordedAt: 'desc' }, include: { parameter: true }, take: 40 });
    const out = {};
    rows.forEach((m) => { if (out[m.parameter.name] === undefined && m.value !== null) out[m.parameter.name] = m.value; });
    return out;
  };

  const rows = [];
  let prev = null;
  for (const f of events) {
    const rd = await near(f.pondId, f.recordedAt, 120);
    const sig = await prisma.activitySignal.findFirst({
      where: { pondId: f.pondId, recordedAt: { lte: f.recordedAt, gte: new Date(new Date(f.recordedAt) - 12e5) }, activityIndex: { not: null } },
      orderBy: { recordedAt: 'desc' } });
    const tray = await prisma.feedingTrayRecord.findFirst({
      where: { pondId: f.pondId, recordedAt: { gte: new Date(new Date(f.recordedAt) - 18e5), lte: new Date(new Date(f.recordedAt).getTime() + 18e5) } },
      orderBy: { recordedAt: 'desc' } });
    const env = await prisma.environmentalRecord.findFirst({
      where: { pondId: f.pondId, recordedAt: { gte: new Date(new Date(f.recordedAt) - 432e5), lte: f.recordedAt } },
      orderBy: { recordedAt: 'desc' } });
    const row = { pond: f.pond.code, date: new Date(f.recordedAt).toISOString() };
    for (const k of feats) {
      row[k] = {
        do: rd['Dissolved Oxygen'] ?? '', ph: rd['pH'] ?? '', temperature: rd['Temperature'] ?? '',
        activityIndex: sig?.activityIndex ?? '', activityLevel: f.activityBefore ?? '',
        prevFeedAmount: prev && prev.pondId === f.pondId ? (prev.amount ?? '') : '',
        timeOfDay: new Date(f.recordedAt).getUTCHours() + new Date(f.recordedAt).getUTCMinutes() / 60,
        weather: f.weather || env?.rainfall || '', rainfall: env?.rainfall ?? '', aeratorStatus: env?.aeratorOn ?? '',
        trayConsumption: tray?.consumption ?? '',
      }[k];
    }
    row.target = { feedingResponse: f.response, consumption: f.consumption }[target] ?? '';
    if (row.target !== '' && row.target !== 'UNKNOWN') rows.push(row);
    prev = f;
  }

  await prisma.mlDataset.create({ data: {
    name: name || `dataset-${Date.now()}`, featureKeys: JSON.stringify(feats), targetKey: target,
    pondId: pondId || null, fromDate: from ? new Date(from) : null, toDate: to ? new Date(to) : null,
    sampleCount: rows.length } });

  if (!rows.length)
    return res.json({ count: 0, csv: '', message: 'No labeled feeding events matched. Add more data or widen filters.' });
  const fields = ['pond', 'date', ...feats, 'target'];
  res.json({ count: rows.length, csv: toCSV(rows, fields) });
}));

r.get('/ml/datasets', requireRole(), wrap(async (_req, res) =>
  res.json(await prisma.mlDataset.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }))));

module.exports = { researchRouter: r, FEATURES };