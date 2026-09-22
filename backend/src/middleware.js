const jwt = require('jsonwebtoken');
const { prisma } = require('./db');

// Decodes JWT if present (optional). Use requireRole to enforce.
function auth(req, _res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try { req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch (_) {}
  }
  next();
}

// ESP32 devices authenticate with x-device-key header
async function deviceAuth(req, _res, next) {
  const key = req.headers['x-device-key'];
  if (key) {
    const device = await prisma.device.findUnique({ where: { apiKey: String(key) } });
    if (device) { req.device = device; return next(); }
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Login required' });
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ error: `Not allowed for role ${req.user.role}` });
    next();
  };
}

// Accepts either a logged-in user or a registered device
function requireAny(...roles) {
  return (req, res, next) => {
    if (req.device) return next();
    if (!req.user) return res.status(401).json({ error: 'Auth required' });
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Research integrity: record who changed what, when (requirement #35)
async function audit(user, action, modelName, recordId, before, after) {
  try {
    await prisma.auditLog.create({
      data: {
        userEmail: user?.email || 'system',
        action, modelName, recordId,
        before: before ? JSON.stringify(before) : undefined,
        after: after ? JSON.stringify(after) : undefined,
      },
    });
  } catch (_) { /* audit must never break the request */ }
}

module.exports = { auth, deviceAuth, requireRole, requireAny, wrap, audit };