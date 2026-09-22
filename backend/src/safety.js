const { prisma } = require('./db');

// ─────────────────────────────────────────────────────────────
// PROTOTYPE CONFIGURATION
// These defaults are for system testing ONLY. They are NOT
// validated biological limits. Each pond can override via
// pond.safetyConfig (edited in the Pond form).
// ─────────────────────────────────────────────────────────────
const DEFAULTS = {
  doMin: 4.0,        // mg/L below this -> DO_NOT_FEED (prototype)
  phMin: 6.5,
  phMax: 8.5,
  tempMin: 18,
  tempMax: 34,
  staleMinutes: 180, // older data than this -> MANUAL_CHECK
};

function thresholds(pond) {
  let cfg = {};
  if (pond && pond.safetyConfig) {
    try { cfg = JSON.parse(pond.safetyConfig); } catch (_) {}
  }
  return { ...DEFAULTS, ...cfg };
}

async function latestReadings(pondId, minutes = 1440) {
  const since = new Date(Date.now() - minutes * 60000);
  const rows = await prisma.sensorMeasurement.findMany({
    where: { pondId, recordedAt: { gte: since }, dataQuality: 'GOOD' },
    orderBy: { recordedAt: 'desc' },
    include: { parameter: true },
  });
  const out = {};
  for (const r of rows) {
    const key = r.parameter.name;
    if (out[key] === undefined && r.value !== null) out[key] = r.value;
  }
  return { readings: out, newestAt: rows[0]?.recordedAt || null };
}

/**
 * Safety layer runs BEFORE any ML recommendation.
 * Safety conditions OVERRIDE the ML output.
 */
async function evaluateSafety(pond, providedReadings, activityIndex) {
  const t = thresholds(pond);
  let readings = providedReadings || {};
  let newestAt = null;
  if (!providedReadings || Object.keys(providedReadings).length === 0) {
    const lr = await latestReadings(pond.id);
    readings = lr.readings;
    newestAt = lr.newestAt;
  }
  const reasons = [];
  let status = 'PASS'; // PASS | OVERRIDE | MANUAL_CHECK

  if (readings['Dissolved Oxygen'] === undefined) {
    reasons.push('No recent DO reading -> data missing requires manual check');
    status = 'MANUAL_CHECK';
  } else if (readings['Dissolved Oxygen'] < t.doMin) {
    reasons.push(`DO ${readings['Dissolved Oxygen']} < configured minimum ${t.doMin} (prototype threshold) -> DO NOT FEED`);
    status = 'OVERRIDE';
  }
  if (readings['pH'] !== undefined && (readings['pH'] < t.phMin || readings['pH'] > t.phMax)) {
    reasons.push(`pH ${readings['pH']} outside configured range ${t.phMin}-${t.phMax} (prototype) -> DO NOT FEED`);
    status = 'OVERRIDE';
  }
  if (readings['Temperature'] !== undefined && (readings['Temperature'] < t.tempMin || readings['Temperature'] > t.tempMax)) {
    reasons.push(`Temperature ${readings['Temperature']}°C outside configured range (prototype) -> DO NOT FEED`);
    status = 'OVERRIDE';
  }
  if (newestAt && (Date.now() - new Date(newestAt)) > t.staleMinutes * 60000) {
    reasons.push(`Sensor data older than ${t.staleMinutes} min -> MANUAL_CHECK`);
    if (status === 'PASS') status = 'MANUAL_CHECK';
  }
  if (activityIndex === undefined || activityIndex === null) {
    reasons.push('No activity index available (activity sensing is experimental)');
  }
  return { status, reasons, readings };
}

/**
 * RULE-BASED FALLBACK recommender (Phase 1).
 * Clearly a heuristic. Replace/supplement with trained ML later.
 */
function ruleRecommendation({ safety, activityIndex }) {
  if (safety.status === 'OVERRIDE') {
    return { rec: 'DO_NOT_FEED', source: 'SAFETY', reason: safety.reasons.join(' | ') };
  }
  if (safety.status === 'MANUAL_CHECK') {
    return { rec: 'MANUAL_CHECK', source: 'SAFETY', reason: safety.reasons.join(' | ') };
  }
  if (activityIndex === undefined || activityIndex === null) {
    return { rec: 'MANUAL_CHECK', source: 'RULES', reason: 'No activity index available; rule-based fallback requires it. (Experimental signal - not validated.)' };
  }
  if (activityIndex >= 0.7) return { rec: 'FEED', source: 'RULES', reason: `Activity index ${activityIndex} >= 0.7 (prototype rule, unvalidated)` };
  if (activityIndex >= 0.4) return { rec: 'REDUCE_FEED', source: 'RULES', reason: `Activity index ${activityIndex} in 0.4-0.7 (prototype rule, unvalidated)` };
  return { rec: 'DELAY_FEED', source: 'RULES', reason: `Activity index ${activityIndex} < 0.4; suggest delay and re-check (prototype rule, unvalidated)` };
}

module.exports = { evaluateSafety, ruleRecommendation, thresholds, DEFAULTS };