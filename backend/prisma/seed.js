const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SPECIES = ['Shrimp', 'Tilapia', 'Rohu', 'Catla', 'Other'];
const PARAMS = [
  ['Dissolved Oxygen', 'mg/L', true, 3, 12],
  ['pH', null, true, 6.5, 8.5],
  ['Temperature', '°C', true, 18, 34],
  ['Turbidity', 'NTU', true, 0, 100],
  ['Salinity', 'ppt', true, 0, 35],
  ['Water Level', 'cm', true, 0, 300],
  ['Ammonia', 'mg/L', false, 0, 0.5],
  ['Nitrite', 'mg/L', false, 0, 1],
  ['Alkalinity', 'mg/L', false, 80, 200],
  ['ORP', 'mV', false, 0, 400],
  ['TDS', 'ppm', false, 0, 2000],
  ['Conductivity', 'µS/cm', false, 0, 5000],
];

// Reference data (species + parameters) is NEVER demo — the app always needs it
async function ensureReferenceData() {
  for (const name of SPECIES)
    await prisma.species.upsert({ where: { name }, update: {}, create: { name } });
  for (const [name, unit, enabled, mn, mx] of PARAMS)
    await prisma.measurementParameter.upsert({
      where: { name },
      update: { enabled },
      create: { name, unit, enabled, minExpected: mn, maxExpected: mx },
    });
}

async function seedDemo() {
  await ensureReferenceData();
  const species = await prisma.species.findUnique({ where: { name: 'Shrimp' } });

  const pond = await prisma.pond.upsert({
    where: { code: 'P-DEMO-01' },
    update: {},
    create: {
      code: 'P-DEMO-01',
      name: 'DEMO Pond (delete anytime)',
      location: 'Demo farm',
      speciesId: species.id,
      areaValue: 1000, areaUnit: 'm²',
      depthValue: 1.2, depthUnit: 'm',
      waterSource: 'Groundwater',
      cultureType: 'Semi-intensive',
      isDemo: true,
      safetyConfig: JSON.stringify({ doMin: 4.0, phMin: 6.5, phMax: 8.5, tempMin: 18, tempMax: 34 }),
      notes: 'DEMO DATA — safe to clear via Admin > Clear Demo Data',
    },
  });

  // avoid duplicate demo rows if seeded twice
  await prisma.sensorMeasurement.deleteMany({ where: { pondId: pond.id, isDemo: true } });
  await prisma.activitySignal.deleteMany({ where: { pondId: pond.id, isDemo: true } });

  const params = {};
  for (const [name] of PARAMS)
    params[name] = await prisma.measurementParameter.findUnique({ where: { name } });

  const now = Date.now();
  for (let d = 6; d >= 0; d--) {
    for (const [name, base, amp] of [['Dissolved Oxygen', 5.2, 1.1], ['pH', 7.6, 0.3], ['Temperature', 28, 2]]) {
      await prisma.sensorMeasurement.create({
        data: {
          pondId: pond.id,
          parameterId: params[name].id,
          recordedAt: new Date(now - d * 864e5 - 6 * 36e5),
          value: +(base + Math.sin(d) * amp).toFixed(2),
          unit: params[name].unit || null,
          method: 'Digital Sensor',
          source: 'ESP32',
          isDemo: true,
        },
      });
    }
    await prisma.activitySignal.create({
      data: {
        pondId: pond.id, sensorId: 'DEMO-A1',
        recordedAt: new Date(now - d * 864e5 - 5 * 36e5),
        rawSignal: +(0.5 + 0.3 * Math.sin(d)).toFixed(3),
        activityIndex: +(0.5 + 0.3 * Math.sin(d)).toFixed(2),
        quality: 'Good', source: 'ESP32', isDemo: true,
      },
    });
  }

  await prisma.feedingEvent.create({
    data: {
      pondId: pond.id, recordedAt: new Date(now - 2 * 864e5),
      feedType: 'Commercial pellet', amount: 1.2, unit: 'kg', method: 'Tray feeding',
      activityBefore: 'MEDIUM', activityDuring: 'HIGH', activityAfter: 'LOW',
      consumption: 'MOSTLY', response: 'MODERATE', weather: 'Sunny',
      isDemo: true, notes: 'DEMO DATA',
    },
  });
  await prisma.activityRecord.create({
    data: {
      pondId: pond.id, recordedAt: new Date(now - 864e5),
      activityLevel: 'HIGH', feedingResponse: 'STRONG', feedPresence: 'Present',
      surfaceCondition: 'Ripples', weather: 'Sunny', rainfall: 'None', wind: 'Light',
      aeratorStatus: 'ON', isDemo: true, notes: 'DEMO DATA',
    },
  });
  console.log('Demo data seeded (flagged isDemo=true).');
}

async function main() {
  await ensureReferenceData();
  await seedDemo();
  console.log('Seed complete: species, parameters, demo pond with 7 days of demo data.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

module.exports = { seedDemo };