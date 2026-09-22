# AquaGuardian AI 🦐

An AI-Driven Autonomous Aquaculture Intelligence System for Predictive Pond Health
Monitoring and Intelligent Feeding — research project.

## Stack
- Backend: Node.js + Express + Prisma (SQLite)
- Frontend: React + Vite (mobile-first, offline-capable)
- ML: Python FastAPI + scikit-learn (RandomForest) — trains on collected field data
- Hardware integration: ESP32 sensor endpoints (ready)
- Alerts: background safety monitor + web push notifications

## Setup (local)
```bash
cd backend && npm install
npx prisma migrate dev
npm run seed
npm run dev          # API on :4000

cd ../frontend && npm install
npm run dev          # UI on :5173