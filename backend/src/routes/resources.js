const express = require('express');
const { crud } = require('../crud');
const { prisma } = require('../db');

const r = express.Router();
const pondInclude = { pond: { select: { id: true, code: true, name: true } } };

// ---- Reference data ----
r.use('/species', crud('species', {
  search: ['name'], hasCreatedBy: false,
  whenField: null, orderBy: { name: 'asc' },
}));
r.use('/parameters', crud('measurementParameter', {
  search: ['name', 'category'], hasCreatedBy: false,
  whenField: null, orderBy: { name: 'asc' },
}));

r.use('/ponds', crud('pond', {
  search: ['code', 'name', 'location'],
  include: { species: true },
  whenField: null,
  orderBy: { createdAt: 'desc' },
}));

// ---- Measurements (flexible: any parameter, value OR textValue) ----
r.use('/measurements', crud('sensorMeasurement', {
  filters: ['source', 'dataQuality', 'method', 'parameterId', 'deviceId'],
  search: ['notes'],
  include: { pond: { select: { code: true, name: true } }, parameter: true },
  beforeCreate: async (body) => {
    if (!body.parameterId) throw Object.assign(new Error('parameterId required'), { status: 400 });
    if (body.value === null && !body.textValue)
      throw Object.assign(new Error('Provide value or textValue'), { status: 400 });
    if (!body.unit) {
      const p = await prisma.measurementParameter.findUnique({ where: { id: body.parameterId } });
      if (p) body.unit = p.unit;
    }
  },
}));

// ---- Activity & field observations (farmers may write) ----
r.use('/activity', crud('activityRecord', {
  farmer: true, filters: ['activityLevel', 'feedingResponse', 'weather'],
  search: ['notes'], include: pondInclude,
}));

// ---- Activity signals (experimental) ----
r.use('/activity-signals', crud('activitySignal', {
  filters: ['sensorId', 'quality'], search: ['notes', 'sensorId'], include: pondInclude,
}));

// ---- Feeding ----
r.use('/feeding', crud('feedingEvent', {
  farmer: true, filters: ['response', 'consumption', 'feedType', 'method'],
  search: ['notes', 'feedType'], include: pondInclude,
}));

r.use('/feeding-trays', crud('feedingTrayRecord', {
  farmer: true, filters: ['trayId', 'consumption'], search: ['notes'], include: pondInclude,
}));

r.use('/environmental', crud('environmentalRecord', {
  filters: ['rainfall', 'aeratorOn'], search: ['notes'], include: pondInclude,
}));

r.use('/health', crud('healthObservation', {
  farmer: true, search: ['notes', 'diseaseSymptoms'], include: pondInclude,
}));

r.use('/daily-logs', crud('dailyPondLog', {
  farmer: true, whenField: null, search: ['notes'], include: pondInclude,
}));

r.use('/feedback', crud('farmerFeedback', {
  whenField: null, search: ['problem', 'notes'], include: pondInclude, hasCreatedBy: false,
}));

r.use('/visits', crud('fieldVisit', {
  whenField: null, search: ['notes', 'observer'], include: pondInclude, hasCreatedBy: false,
}));

r.use('/experiments', crud('experiment', {
  search: ['name', 'objective'], include: pondInclude, hasCreatedBy: false,
  whenField: null, orderBy: { createdAt: 'desc' },
}));

r.use('/experiment-records', crud('experimentRecord', {
  whenField: null, filters: ['experimentId', 'refType'], hasDemo: false, hasCreatedBy: false,
}));

r.use('/labels', crud('mlLabel', {
  filters: ['status'], search: ['summary'], include: pondInclude, hasDemo: false, hasCreatedBy: false,
}));

r.use('/alerts', crud('alert', {
  filters: ['severity', 'type'], search: ['message'], hasDemo: false, hasCreatedBy: false,
  whenField: null, orderBy: { createdAt: 'desc' },
}));

r.use('/ai-decisions', crud('aiDecision', {
  filters: ['finalRecommendation'], search: ['reason'], include: pondInclude, hasCreatedBy: false,
}));

module.exports = r;