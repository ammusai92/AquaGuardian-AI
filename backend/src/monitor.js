const express = require('express');
const { prisma } = require('./db');
const { requireRole, wrap } = require('./middleware');
const { evaluateSafety } = require('./safety');
const { getSetting, setSetting, getVapidKeys, sendPushToAll } = require('./push');

const r = express.Router();

async function runMonitorOnce() {
  const enabled = await getSetting('monitor.enabled', 'true');
  if (enabled !== 'true') return { skipped: true, reason: 'monitor disabled' };
  const dedupeHours = Number(await getSetting('monitor.dedupeHours', '6')) || 0;
  const ponds = await prisma.pond.findMany({ where: { isDemo: false } });
  const results = [];
  for (const pond of ponds) {
    try {
      const safety = await evaluateSafety(pond, null, null);
      if (safety.status !== 'OVERRIDE') continue; // only alert on real danger
      if (dedupeHours > 0) {
        const since = new Date(Date.now() - dedupeHours * 36e5);
        const recent = await prisma.alert.findFirst({
          where: { pondId: pond.id, type: 'AUTO_MONITOR', createdAt: { gte: since } },
        });
        if (recent) continue; // already warned recently — no spam
      }
      const alert = await prisma.alert.create({
        data: { pondId: pond.id, type: 'AUTO_MONITOR', severity: 'WARNING',
                message: safety.reasons.join(' | ') },
      });
      const pushSent = await sendPushToAll(
        `⚠️ AquaGuardian — Pond ${pond.code}`,
        safety.reasons.join(' | ').slice(0, 200)
      );
      results.push({ pond: pond.code, alertId: alert.id, pushSent });
    } catch (e) {
      results.push({ pond: pond.code, error: e.message });
    }
  }
  return { checked: ponds.length, triggered: results.length, results };
}

r.post('/monitor/run', requireRole('ADMIN', 'RESEARCHER'), wrap(async (_req, res) => {
  res.json(await runMonitorOnce());
}));

r.get('/monitor/settings', requireRole('ADMIN', 'RESEARCHER'), wrap(async (_req, res) => {
  res.json({
    monitorEnabled: (await getSetting('monitor.enabled', 'true')) === 'true',
    dedupeHours: Number(await getSetting('monitor.dedupeHours', '6')) || 0,
  });
}));

r.put('/monitor/settings', requireRole('ADMIN'), wrap(async (req, res) => {
  const { monitorEnabled, dedupeHours } = req.body || {};
  if (monitorEnabled !== undefined) await setSetting('monitor.enabled', monitorEnabled ? 'true' : 'false');
  if (dedupeHours !== undefined) await setSetting('monitor.dedupeHours', String(Number(dedupeHours) || 0));
  res.json({ ok: true });
}));

// ---- Push notification endpoints ----
r.get('/push/public-key', requireRole(), wrap(async (_req, res) => {
  const keys = await getVapidKeys();
  res.json({ publicKey: keys.publicKey });
}));

r.post('/push/subscribe', requireRole(), wrap(async (req, res) => {
  const sub = req.body || {};
  if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth)
    return res.status(400).json({ error: 'Invalid subscription' });
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userEmail: req.user?.email },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userEmail: req.user?.email },
  });
  res.json({ ok: true });
}));

r.post('/push/test', requireRole('ADMIN', 'RESEARCHER'), wrap(async (_req, res) => {
  const n = await sendPushToAll('🔔 AquaGuardian test',
    'Push notifications are working! Pond alerts will appear here.');
  res.json({ delivered: n, note: n === 0 ? 'No devices subscribed yet — click "Enable alerts" first.' : 'Check your notification tray!' });
}));

function startMonitor() {
  const tick = async () => {
    try {
      const out = await runMonitorOnce();
      if (out.triggered) console.log('[monitor]', JSON.stringify(out));
    } catch (e) {
      console.error('[monitor]', e.message);
    }
  };
  setTimeout(tick, 15000);            // first check shortly after boot
  setInterval(tick, 15 * 60 * 1000);  // then every 15 minutes
  console.log('Auto-monitor started (checks every 15 min)');
}

module.exports = { router: r, startMonitor, runMonitorOnce };