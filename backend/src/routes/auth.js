const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const { requireRole, wrap } = require('../middleware');

const r = express.Router();

r.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email: String(email || '').toLowerCase() } });
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

r.get('/me', requireRole(), (req, res) => res.json(req.user));

r.get('/users', requireRole('ADMIN'), wrap(async (_req, res) => {
  res.json(await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  }));
}));

r.post('/users', requireRole('ADMIN'), wrap(async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await prisma.user.create({
    data: { email: String(email).toLowerCase(), name: name || email,
            role: role || 'RESEARCHER', passwordHash: await bcrypt.hash(password, 10) },
  });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
}));

r.put('/users/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const data = {};
  if (req.body.role) data.role = req.body.role;
  if (req.body.password) data.passwordHash = await bcrypt.hash(req.body.password, 10);
  if (req.body.name) data.name = req.body.name;
  res.json(await prisma.user.update({ where: { id: req.params.id }, data,
    select: { id: true, email: true, name: true, role: true } }));
}));

module.exports = r;