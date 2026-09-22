const express = require('express');
const fs = require('fs');
const multer = require('multer');
const { prisma } = require('../db');
const { requireRole, requireAny, wrap, deviceAuth } = require('../middleware');
const { toCSV } = require('../csv');

const r = express.Router();

// ---------- CSV EXPORT CONFIG ----------
const EXPORTS = {
  measurements:       { model: 'sensorMeasurement', dateField: 'recordedAt', hasSource: true, hasCreatedBy: true,
    fields: ['id', 'pond', 'parameter', 'date', 'value', 'textValue', 'unit', 'method', 'source', 'dataQuality', 'notes'] },
  activity:           { model: 'activityRecord', dateField: 'recordedAt', hasSource: true, hasCreatedBy: true,
    fields: ['id', 'pond', 'date', 'durationMin', 'activityLevel', 'feedingResponse', 'feedPresence', 'surfaceCondition', 'behaviour', 'weather', 'rainfall', 'wind', 'aeratorStatus', 'notes'] },
  'activity-signals': { model: 'activitySignal', dateField: 'recordedAt', hasSource: true, hasCreatedBy: true,
    fields: ['id', 'pond', 'date', 'sensorId', 'rawSignal', 'activityIndex', 'durationSec', 'quality', 'position', 'noise', 'notes'] },
  feeding:            { model: 'feedingEvent', dateField: 'recordedAt', hasSource: true, hasCreatedBy: true,
    fields: ['id', 'pond', 'date', 'feedType', 'amount', 'unit', 'method', 'durationMin', 'activityBefore', 'activityDuring', 'activityAfter', 'consumption', 'response', 'remainingFeed', 'weather', 'doBefore', 'phBefore', 'tempBefore', 'automatic', 'actualDecision', 'notes'] },
  'feeding-trays':    { model: 'feedingTrayRecord', dateField: 'recordedAt', hasCreatedBy: true,
    fields: ['id', 'pond', 'date', 'trayId', 'feedGiven', 'remainingFeed', 'consumption', 'observationMin', 'trayCondition', 'notes'] },
  environmental:      { model: 'environmentalRecord', dateField: 'recordedAt', hasCreatedBy: true,
    fields: ['id', 'pond', 'date', 'airTemp', 'rainfall', 'windCondition', 'cloudCondition', 'sunlight', 'aeratorOn', 'aeratorCount', 'aeratorRuntimeMin', 'notes'] },
  health:             { model: 'healthObservation', dateField: 'recordedAt', hasCreatedBy: true,
    fields: ['id', 'pond', 'date', 'speciesName', 'mortalityCount', 'observedCondition', 'unusualBehaviour', 'diseaseSymptoms', 'waterCondition', 'notes'] },
  'daily-logs':       { model: 'dailyPondLog', dateField: 'date', hasCreatedBy: true,
    fields: ['id', 'pond', 'date', 'generalCondition', 'waterAppearance', 'waterOdour', 'surfaceActivity', 'behaviour', 'feedResponse', 'mortalityCount', 'aeratorStatus', 'weather', 'rainfall', 'diseaseSymptoms', 'unusualEvents', 'notes'] },
  feedback:           { model: 'farmerFeedback', dateField: 'date',
    fields: ['id', 'date', 'pond', 'observer', 'problem', 'currentPractice', 'equipmentUsed', 'mainDifficulty', 'desiredImprovement', 'opinionAutoFeeding', 'opinionMonitoring', 'notes'] },
  visits:             { model: 'fieldVisit', dateField: 'date',
    fields: ['id', 'date', 'location', 'pond', 'observer', 'purpose', 'measurementsCollected', 'activitiesObserved', 'farmerFeedback', 'problemsIdentified', 'followUpRequired', 'notes'] },
  'ai-decisions':     { model: 'aiDecision', dateField: 'recordedAt',
    fields: ['id', 'pond', 'date', 'doValue', 'phValue', 'tempValue', 'activityIndex', 'previousFeedAmount', 'mlRecommendation', 'safetyStatus', 'finalRecommendation', 'actualFeedGiven', 'farmerOverride', 'reason'] },
  labels:             { model: 'mlLabel', dateField: 'recordedAt', hasIsDemo: false,
    fields: ['id', 'pond', 'date', 'refType', 'refId', 'summary', 'labelValue', 'status', 'notes'] },
};

r.get('/export/:resource', requireRole(), wrap(async (req, res) => {
  const cfg = EXPORTS[req.params.resource];
  if (!cfg) return res.status(404).json({ error: 'Unknown resource' });
  const { pondId, from, to, demo } = req.query;
  const df = cfg.dateField;
  const where = {};
  if (pondId) where.pondId = pondId;
  if (from || to) where[df] = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(`${to}T23:59:59`) }) };
  if (demo !== '1' && cfg.hasIsDemo !== false) where.isDemo = false;
  const rows = await prisma[cfg.model].findMany({ where, orderBy: { [df]: 'desc' }, take: 5000, include: { pond: { select: { code: true } } } });
  const flat = rows.map((row) => {
    const o = { ...row, pond: row.pond?.code || '', date: row[df] };
    delete o.pondId;
    return o;
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.resource}-${Date.now()}.csv"`);
  res.send(toCSV(flat, cfg.fields));
}));

// ---------- CSV IMPORT (bulk; frontend previews & validates first) ----------
const NUMERIC = ['value', 'amount', 'rawSignal', 'activityIndex', 'feedGiven', 'remainingFeed', 'airTemp',
  'aeratorCount', 'aeratorRuntimeMin', 'mortalityCount', 'doBefore', 'phBefore', 'tempBefore',
  'durationMin', 'durationSec', 'observationMin', 'stockingDensity', 'stockingCount', 'areaValue', 'depthValue'];

r.post('/import/:resource', requireRole('ADMIN', 'RESEARCHER'), wrap(async (req, res) => {
  const cfg = EXPORTS[req.params.resource];
  if (!cfg) return res.status(404).json({ error: 'Unknown resource' });
  const rows = req.body.rows || [];
  if (!rows.length) return res.status(400).json({ error: 'No rows' });
  let imported = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      const b = { ...rows[i] };
      delete b.id; delete b.pond; delete b.parameter;
      if (cfg.hasSource) b.source = 'IMPORTED_CSV';
      if (cfg.hasCreatedBy) b.createdById = req.user.id;
      if (cfg.hasIsDemo !== false) b.isDemo = false;
      // date handling depends on the model
      if (cfg.dateField === 'recordedAt') {
        if (b.date) { const d = new Date(b.date); if (isNaN(d)) throw new Error('invalid date'); b.recordedAt = d; }
        delete b.date;
      } else {
        if (!b.date) throw new Error('date required');
        const d = new Date(b.date); if (isNaN(d)) throw new Error('invalid date'); b.date = d;
      }
      for (const k of NUMERIC) {
        if (b[k] === undefined) continue;
        if (b[k] === '') { delete b[k]; continue; }
        const n = Number(b[k]);
        if (isNaN(n)) throw new Error(`${k} is not a number`);
        b[k] = n;
      }
      if (b.followUpRequired !== undefined) b.followUpRequired = b.followUpRequired === 'true' || b.followUpRequired === true;
      if (b.automatic !== undefined) b.automatic = b.automatic === 'true' || b.automatic === true;
      await prisma[cfg.model].create({ data: b });
      imported++;
    } catch (e) { errors.push({ row: i + 1, error: e.message }); }
  }
  res.json({ imported, failed: errors.length, errors: errors.slice(0, 20) });
}));

// ---------- DEMO DATA (only models that have isDemo) ----------
const DEMO_ORDER = ['aiDecision', 'feedingEvent', 'feedingTrayRecord', 'activitySignal', 'activityRecord',
  'sensorMeasurement', 'environmentalRecord', 'healthObservation', 'dailyPondLog', 'farmerFeedback',
  'fieldVisit', 'experiment', 'pond'];

r.delete('/demo-data', requireRole('ADMIN'), wrap(async (_req, res) => {
  const deleted = {};
  for (const m of DEMO_ORDER) {
    const out = await prisma[m].deleteMany({ where: { isDemo: true } });
    deleted[m] = out.count;
  }
  res.json({ ok: true, deleted });
}));

r.post('/demo-data', requireRole('ADMIN'), wrap(async (_req, res) => {
  const { seedDemo } = require('../../prisma/seed');
  await seedDemo();
  res.json({ ok: true });
}));

// ---------- DEVICES / ESP32 ----------
r.get('/devices', requireRole(), wrap(async (_req, res) =>
  res.json(await prisma.device.findMany({ orderBy: { createdAt: 'desc' } }))));

r.post('/devices', requireRole('ADMIN', 'RESEARCHER'), wrap(async (req, res) => {
  const { name, type, pondId } = req.body;
  res.status(201).json(await prisma.device.create({
    data: { name: name || 'ESP32', type: type || 'ESP32', pondId: pondId || null } }));
}));

r.post('/device/heartbeat', deviceAuth, wrap(async (req, res) => {
  if (!req.device) return res.status(401).json({ error: 'Invalid device key' });
  await prisma.device.update({ where: { id: req.device.id }, data: { lastHeartbeat: new Date(), status: 'ONLINE' } });
  res.json({ ok: true, serverTime: new Date().toISOString() });
}));

r.get('/device/commands', deviceAuth, wrap(async (req, res) => {
  if (!req.device) return res.status(401).json({ error: 'Invalid device key' });
  const d = await prisma.device.findUnique({ where: { id: req.device.id } });
  if (d.pendingCommand && !d.commandTakenAt) {
    await prisma.device.update({ where: { id: d.id }, data: { commandTakenAt: new Date() } });
    let cmd = null;
    try { cmd = JSON.parse(d.pendingCommand); } catch (_) { cmd = d.pendingCommand; }
    return res.json({ command: cmd, issuedAt: d.commandAt });
  }
  res.json({ command: null });
}));

r.post('/feeder/command', requireRole('ADMIN', 'RESEARCHER'), wrap(async (req, res) => {
  const { deviceId, command, params } = req.body || {};
  const d = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!d) return res.status(404).json({ error: 'Device not found' });
  await prisma.device.update({ where: { id: deviceId },
    data: { pendingCommand: JSON.stringify({ command, params: params || {} }),
            commandAt: new Date(), commandTakenAt: null } });
  res.json({ ok: true, note: 'Device will receive command on next poll' });
}));

// ---------- SENSORS ----------
r.get('/sensors/latest', requireAny(), wrap(async (req, res) => {
  const { pondId } = req.query;
  if (!pondId) return res.status(400).json({ error: 'pondId required' });
  const params = await prisma.measurementParameter.findMany({ where: { enabled: true } });
  const out = {};
  for (const p of params) {
    const m = await prisma.sensorMeasurement.findFirst({
      where: { pondId, parameterId: p.id }, orderBy: { recordedAt: 'desc' } });
    if (m) out[p.name] = { value: m.value, textValue: m.textValue, unit: p.unit, at: m.recordedAt, quality: m.dataQuality };
  }
  res.json(out);
}));

r.get('/sensors/history', requireAny(), wrap(async (req, res) => {
  const { pondId, parameterId, from, to } = req.query;
  const where = { ...(pondId && { pondId }), ...(parameterId && { parameterId }) };
  if (from || to) where.recordedAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
  res.json(await prisma.sensorMeasurement.findMany({ where, orderBy: { recordedAt: 'asc' }, take: 5000 }));
}));

// ---------- PHOTOS ----------
const uploadDir = process.env.UPLOAD_DIR || './uploads';
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '_')}`),
}) });

r.post('/photos', requireRole('ADMIN', 'RESEARCHER', 'FARMER'), upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { pondId, refType, refId, caption, takenAt } = req.body;
  const photo = await prisma.photo.create({ data: {
    pondId: pondId || null, refType: refType || null, refId: refId || null,
    fileUrl: `/uploads/${req.file.filename}`, caption: caption || null,
    takenAt: takenAt ? new Date(takenAt) : new Date() } });
  res.status(201).json(photo);
}));

r.get('/photos', requireRole(), wrap(async (req, res) => {
  const { pondId, refType, refId } = req.query;
  res.json(await prisma.photo.findMany({
    where: { ...(pondId && { pondId }), ...(refType && { refType }), ...(refId && { refId }) },
    orderBy: { createdAt: 'desc' }, take: 200 }));
}));

module.exports = r;