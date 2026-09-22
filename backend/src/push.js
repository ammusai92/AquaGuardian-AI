const webpush = require('web-push');
const { prisma } = require('./db');

async function getSetting(key, fallback = null) {
  try {
    const s = await prisma.appSetting.findUnique({ where: { key } });
    if (s && s.value !== null && s.value !== '') return s.value;
  } catch (_) {}
  return fallback;
}

async function setSetting(key, value) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

// VAPID keys identify our app to Google's push service.
// Auto-generated once, stored in the database — no manual setup needed.
async function getVapidKeys() {
  let publicKey = await getSetting('vapid.public', '');
  let privateKey = await getSetting('vapid.private', '');
  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    await setSetting('vapid.public', keys.publicKey);
    await setSetting('vapid.private', keys.privateKey);
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    console.log('Generated new VAPID keys for push notifications');
  }
  return { publicKey, privateKey };
}

async function sendPushToAll(title, body) {
  try {
    const { publicKey, privateKey } = await getVapidKeys();
    webpush.setVapidDetails('mailto:alerts@aquaguardian.local', publicKey, privateKey);
    const subs = await prisma.pushSubscription.findMany();
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body })
        );
        sent++;
      } catch (e) {
        // subscription expired/removed on the device -> clean it up
        if (e.statusCode === 404 || e.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }
    return sent;
  } catch (e) {
    console.error('push error:', e.message);
    return 0;
  }
}

module.exports = { getSetting, setSetting, getVapidKeys, sendPushToAll };