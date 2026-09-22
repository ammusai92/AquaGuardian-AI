require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { prisma } = require('./db');
const { auth } = require('./middleware');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '15mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'AquaGuardian API', time: new Date() }));

app.use('/api', auth);
app.use('/api/auth', require('../routes/auth'));
app.use('/api', require('../routes/resources'));
app.use('/api', require('../routes/research').researchRouter);
app.use('/api', require('../routes/integrations'));

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@aquaguardian.local').toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({ data: { email, name: 'Administrator', role: 'ADMIN',
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'change-me-123', 10) } });
    console.log(`Created admin user: ${email}`);
  }
}

const PORT = process.env.PORT || 4000;
ensureAdmin()
  .then(() => app.listen(PORT, () => console.log(`AquaGuardian API on http://localhost:${PORT}`)))
  .catch((e) => { console.error(e); process.exit(1); });

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });