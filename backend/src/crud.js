const express = require('express');
const { prisma } = require('./db');
const { requireRole, wrap, audit } = require('./middleware');

// Combine separate date + time (from forms) into one timestamp
function parseWhen(body) {
  if (body.recordedAt) return new Date(body.recordedAt);
  if (body.date) return new Date(`${body.date}T${body.time || '00:00'}:00`);
  return undefined;
}

// ---- Type coercion maps: forms send text, DB wants numbers/dates ----
const NUMERIC_FIELDS = {
  pond: ['areaValue', 'depthValue', 'stockingDensity'],
  sensorMeasurement: ['value'],
  activityRecord: ['durationMin'],
  activitySignal: ['rawSignal', 'activityIndex', 'durationSec'],
  feedingEvent: ['amount', 'durationMin', 'doBefore', 'phBefore', 'tempBefore'],
  feedingTrayRecord: ['feedGiven', 'remainingFeed', 'observationMin'],
  environmentalRecord: ['airTemp', 'aeratorCount', 'aeratorRuntimeMin'],
  healthObservation: ['mortalityCount'],
  dailyPondLog: ['mortalityCount'],
};
const INT_FIELDS = {
  pond: ['stockingCount'],
};
const DATE_FIELDS = {
  pond: ['stockingDate'],
  experiment: ['startDate', 'endDate'],
};

function coerceTypes(modelName, body) {
  for (const k of NUMERIC_FIELDS[modelName] || []) {
    if (typeof body[k] === 'string') {
      const t = body[k].trim();
      if (t === '') { body[k] = null; continue; }
      const n = Number(t);
      if (isNaN(n)) delete body[k]; else body[k] = n;
    }
  }
  for (const k of INT_FIELDS[modelName] || []) {
    if (typeof body[k] === 'string') {
      const t = body[k].trim();
      if (t === '') { body[k] = null; continue; }
      const n = parseInt(t, 10);
      if (isNaN(n)) delete body[k]; else body[k] = n;
    }
  }
  for (const k of DATE_FIELDS[modelName] || []) {
    if (typeof body[k] === 'string') {
      const t = body[k].trim();
      if (t === '') { body[k] = null; continue; }
      const d = new Date(t);
      body[k] = isNaN(d) ? null : d;
    }
  }
}

/**
 * Generic CRUD router for one Prisma model.
 * opts: { filters:[], search:[], include:{}, orderBy, farmer(bool),
 *         whenField('recordedAt'|null), beforeCreate(async body, req),
 *         hasDemo(bool: model has isDemo), hasCreatedBy(bool) }
 */
function crud(modelName, opts = {}) {
  const r = express.Router();
  const db = prisma[modelName];
  const whenField = opts.whenField === undefined ? 'recordedAt' : opts.whenField;
  const orderBy = opts.orderBy || (whenField ? { [whenField]: 'desc' } : { createdAt: 'desc' });
  const writeRoles = opts.farmer ? ['ADMIN', 'RESEARCHER', 'FARMER'] : ['ADMIN', 'RESEARCHER'];
  const hasDemo = opts.hasDemo !== false;
  const hasCreatedBy = opts.hasCreatedBy !== false;

  r.get('/', requireRole(), wrap(async (req, res) => {
    const { pondId, from, to, q, demo, limit = '500', offset = '0', ...rest } = req.query;
    const where = {};
    if (pondId) where.pondId = pondId;
    if (whenField && (from || to))
      where[whenField] = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(`${to}T23:59:59`) }) };
    if (demo !== '1' && hasDemo) where.isDemo = false; // demo data hidden unless requested
    for (const k of opts.filters || []) {
      if (rest[k] === undefined || rest[k] === '') continue;
      where[k] = rest[k] === 'true' ? true : rest[k] === 'false' ? false : rest[k];
    }
    if (q && (opts.search || []).length)
      where.OR = opts.search.map((f) => ({ [f]: { contains: q } }));
    const rows = await db.findMany({
      where, orderBy,
      take: Math.min(parseInt(limit), 2000), skip: parseInt(offset),
      include: opts.include,
    });
    res.json(rows);
  }));

  r.post('/', requireRole(...writeRoles), wrap(async (req, res) => {
    const body = { ...req.body };
    ['id', 'createdAt', 'updatedAt', 'time'].forEach((k) => delete body[k]);
    if (whenField) {
      const w = parseWhen(body); if (w) body.recordedAt = w;
      delete body.date;
    } else if (typeof body.date === 'string') {
      body.date = body.date === '' ? null : new Date(body.date);
    }
    Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null; }); // blank = empty
    coerceTypes(modelName, body);
    if (hasDemo) { if (typeof body.isDemo !== 'boolean') body.isDemo = false; } else delete body.isDemo;
    if (hasCreatedBy) body.createdById = req.user?.id; else delete body.createdById;
    if (opts.beforeCreate) await opts.beforeCreate(body, req);
    const row = await db.create({ data: body, include: opts.include });
    await audit(req.user, 'CREATE', modelName, row.id, null, row);
    res.status(201).json(row);
  }));

  r.put('/:id', requireRole(...writeRoles), wrap(async (req, res) => {
    const body = { ...req.body };
    ['id', 'createdAt', 'updatedAt', 'time'].forEach((k) => delete body[k]);
    if (whenField) {
      if (req.body.date || req.body.time) body.recordedAt = parseWhen(req.body);
      delete body.date;
    } else if (typeof body.date === 'string') {
      body.date = body.date === '' ? null : new Date(body.date);
    }
    Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null; });
    coerceTypes(modelName, body);
    if (!hasDemo) delete body.isDemo;
    if (!hasCreatedBy) delete body.createdById;
    const before = await db.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Not found' });
    const row = await db.update({ where: { id: req.params.id }, data: body, include: opts.include });
    await audit(req.user, 'UPDATE', modelName, row.id, before, row);
    res.json(row);
  }));

  r.delete('/:id', requireRole('ADMIN', 'RESEARCHER'), wrap(async (req, res) => {
    if (req.query.confirm !== '1')   // deletion must be explicitly confirmed
      return res.status(400).json({ error: 'Pass ?confirm=1 after user confirmation' });
    const before = await db.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Not found' });
    await db.delete({ where: { id: req.params.id } });
    await audit(req.user, 'DELETE', modelName, req.params.id, before, null);
    res.json({ ok: true });
  }));

  return r;
}

module.exports = { crud, parseWhen };