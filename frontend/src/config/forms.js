// NAMING RULES: "Activity Level", "Activity Signal",
// "Observed Feeding Response" — never "hunger".

export const ACTIVITY_LEVELS = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'].map((v) => ({ v, l: v.replaceAll('_', ' ') }));
export const RESPONSES = ['STRONG', 'MODERATE', 'WEAK', 'NONE', 'UNKNOWN'].map((v) => ({ v, l: v === 'NONE' ? 'NO RESPONSE' : `${v} RESPONSE` }));
export const CONSUMPTION = ['FULL', 'MOSTLY', 'PARTIAL', 'SIGNIFICANT_REMAINING', 'UNKNOWN'].map((v) => ({ v, l: v.replaceAll('_', ' ') }));
export const SOURCES = ['MANUAL', 'ESP32', 'IMPORTED_CSV', 'OTHER'];
export const QUALITY = ['GOOD', 'QUESTIONABLE', 'INVALID', 'MISSING'];

const METHODS = ['Digital Sensor', 'Test Kit', 'Laboratory', 'Manual Observation', 'ESP32'];
const WEATHER = ['Sunny', 'Cloudy', 'Rainy', 'Overcast', 'Windy', 'Other'];
const RAIN = ['None', 'Light', 'Moderate', 'Heavy'];
const WIND = ['Calm', 'Light', 'Moderate', 'Strong'];

const dt = [
  { name: 'pondId', label: 'Pond', type: 'select', options: 'ponds', required: true },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'time', label: 'Time', type: 'time' },
];
const fmt = (r) => (r.recordedAt || '').slice(0, 16).replace('T', ' ');
const fmtDate = (r) => (r.date || '').slice(0, 10);
const num = (v, suffix) => (v === null || v === undefined || v === '' ? '' : `${v} ${suffix || ''}`);

export const RESOURCES = {
  ponds: {
    title: 'Pond Management', endpoint: '/api/ponds',
    fields: [
      { name: 'code', label: 'Pond ID', required: true },
      { name: 'name', label: 'Pond Name', required: true },
      { name: 'location', label: 'Location' },
      { name: 'speciesId', label: 'Species', type: 'select', options: 'species', hint: 'add species in Admin' },
      { name: 'areaValue', label: 'Pond Area', type: 'number' },
      { name: 'areaUnit', label: 'Area Unit', type: 'select', options: ['m²', 'ha', 'decimal'] },
      { name: 'depthValue', label: 'Pond Depth', type: 'number' },
      { name: 'depthUnit', label: 'Depth Unit', type: 'select', options: ['m', 'ft'] },
      { name: 'waterSource', label: 'Water Source', type: 'select', options: ['Groundwater', 'River/canal', 'Rain-fed', 'Municipal', 'Other'] },
      { name: 'stockingDate', label: 'Stocking Date', type: 'date' },
      { name: 'stockingDensity', label: 'Stocking Density', type: 'number', hint: 'e.g. individuals/m²' },
      { name: 'stockingCount', label: 'Stocking Count', type: 'number' },
      { name: 'cultureType', label: 'Culture Type', type: 'select', options: ['Extensive', 'Semi-intensive', 'Intensive', 'Other'] },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
      { name: 'safetyConfigText', label: 'Safety Thresholds (JSON, optional)', type: 'textarea', full: true,
        hint: 'PROTOTYPE CONFIGURATION — not universal biological limits. e.g. {"doMin":4,"phMin":6.5,"phMax":8.5}' },
    ],
    cols: [
      ['Code', 'code'], ['Name', 'name'],
      ['Species', (r) => r.species?.name || ''],
      ['Location', 'location'],
      ['Area', (r) => num(r.areaValue, r.areaUnit)],
      ['Demo', (r) => (r.isDemo ? 'DEMO' : '')],
    ],
    toBody: (b) => {
      const out = { ...b };
      if (out.safetyConfigText) {
        try { out.safetyConfig = JSON.parse(out.safetyConfigText); } catch (_) { /* keep as text */ }
      }
      delete out.safetyConfigText;
      return out;
    },
    rowToForm: (r) => {
      const v = { ...r };
      if (r.safetyConfig) {
        try { v.safetyConfigText = JSON.stringify(r.safetyConfig); } catch (_) {}
      }
      return v;
    },
  },

  measurements: {
    title: 'Pond Measurements', endpoint: '/api/measurements',
    fields: [
      ...dt,
      { name: 'parameterId', label: 'Parameter', type: 'select', options: 'parameters', required: true, hint: 'add custom parameters in Admin' },
      { name: 'value', label: 'Value', type: 'number', hint: 'leave blank if qualitative' },
      { name: 'textValue', label: 'Text Value (optional)' },
      { name: 'method', label: 'Measurement Method', type: 'select', options: METHODS },
      { name: 'source', label: 'Source', type: 'select', options: SOURCES },
      { name: 'dataQuality', label: 'Data Quality', type: 'select', options: QUALITY },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    filters: [
      { k: 'parameterId', dyn: 'parameters', label: 'parameter' },
      { k: 'source', options: SOURCES, label: 'source' },
      { k: 'dataQuality', options: QUALITY, label: 'quality' },
    ],
    cols: [
      ['Pond', (r) => r.pond?.code || ''],
      ['Parameter', (r) => r.parameter?.name || ''],
      ['Value', (r) => num(r.value ?? r.textValue, r.unit)],
      ['Date', fmt], ['Method', 'method'], ['Source', 'source'],
      ['Quality', (r) => r.dataQuality],
    ],
  },

  activity: {
    title: 'Activity & Field Observations', endpoint: '/api/activity', farmer: true, photo: true,
    fields: [
      ...dt,
      { name: 'durationMin', label: 'Observation Duration (min)', type: 'number' },
      { name: 'activityLevel', label: 'Activity Level', type: 'select', options: ACTIVITY_LEVELS },
      { name: 'feedingResponse', label: 'Feeding Behaviour Indicator', type: 'select', options: RESPONSES },
      { name: 'feedPresence', label: 'Feed Presence', type: 'select', options: ['Present', 'Partial', 'Absent', 'Unknown'] },
      { name: 'surfaceCondition', label: 'Water Surface Condition', type: 'select', options: ['Calm', 'Ripples', 'Bubbles', 'Foam', 'Oily film', 'Other'] },
      { name: 'behaviour', label: 'Fish/Shrimp Behaviour', type: 'textarea', full: true },
      { name: 'weather', label: 'Weather Condition', type: 'select', options: WEATHER },
      { name: 'rainfall', label: 'Rainfall', type: 'select', options: RAIN },
      { name: 'wind', label: 'Wind Condition', type: 'select', options: WIND },
      { name: 'aeratorStatus', label: 'Aerator Status', type: 'select', options: ['ON', 'OFF', 'PARTIAL'] },
      { name: 'otherActivity', label: 'Other Activity' },
      { name: 'notes', label: 'Observer Notes', type: 'textarea', full: true },
    ],
    filters: [{ k: 'activityLevel', options: ACTIVITY_LEVELS, label: 'activity' }],
    cols: [
      ['Pond', (r) => r.pond?.code || ''], ['Date', fmt],
      ['Activity Level', 'activityLevel'], ['Response', 'feedingResponse'],
      ['Weather', 'weather'], ['Notes', (r) => (r.notes || '').slice(0, 40)],
    ],
  },

  'activity-signals': {
    title: 'Activity Signal (Experimental)', endpoint: '/api/activity-signals',
    note: 'Experimental activity sensing. The signal is NOT assumed to indicate feeding behaviour — compare it with observed responses in Research Analytics.',
    fields: [
      ...dt,
      { name: 'sensorId', label: 'Sensor ID' },
      { name: 'rawSignal', label: 'Raw Signal', type: 'number' },
      { name: 'activityIndex', label: 'Activity Index (0–1)', type: 'number', step: '0.01', hint: 'manual now; ESP32 auto later' },
      { name: 'durationSec', label: 'Signal Duration (s)', type: 'number' },
      { name: 'quality', label: 'Signal Quality', type: 'select', options: ['Good', 'Fair', 'Poor'] },
      { name: 'position', label: 'Sensor Position' },
      { name: 'noise', label: 'Environmental Noise' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    filters: [{ k: 'sensorId', label: 'sensor' }],
    cols: [
      ['Pond', (r) => r.pond?.code || ''], ['Date', fmt], ['Sensor', 'sensorId'],
      ['Raw', 'rawSignal'], ['Index', 'activityIndex'], ['Quality', 'quality'],
    ],
  },

  feeding: {
    title: 'Feeding Observations', endpoint: '/api/feeding', farmer: true, photo: true,
    fields: [
      ...dt,
      { name: 'feedType', label: 'Feed Type', type: 'select', options: ['Commercial pellet', 'Homemade feed', 'Rice bran', 'Other'] },
      { name: 'amount', label: 'Feed Amount', type: 'number' },
      { name: 'unit', label: 'Feed Unit', type: 'select', options: ['kg', 'g'] },
      { name: 'method', label: 'Feeding Method', type: 'select', options: ['Hand broadcasting', 'Tray feeding', 'Bag feeding', 'Automatic feeder', 'Other'] },
      { name: 'durationMin', label: 'Feeding Duration (min)', type: 'number' },
      { name: 'activityBefore', label: 'Activity Before Feeding', type: 'select', options: ACTIVITY_LEVELS },
      { name: 'activityDuring', label: 'Activity During Feeding', type: 'select', options: ACTIVITY_LEVELS },
      { name: 'activityAfter', label: 'Activity After Feeding', type: 'select', options: ACTIVITY_LEVELS },
      { name: 'consumption', label: 'Observed Feed Consumption', type: 'select', options: CONSUMPTION },
      { name: 'response', label: 'Feeding Response', type: 'select', options: RESPONSES },
      { name: 'remainingFeed', label: 'Remaining Feed', type: 'select', options: ['None', 'Little', 'Some', 'Much', 'Unknown'] },
      { name: 'weather', label: 'Weather', type: 'select', options: WEATHER },
      { name: 'doBefore', label: 'DO Before (mg/L)', type: 'number' },
      { name: 'phBefore', label: 'pH Before', type: 'number' },
      { name: 'tempBefore', label: 'Temperature Before (°C)', type: 'number' },
      { name: 'automatic', label: 'Automatic Feeding?', type: 'checkbox' },
      { name: 'actualDecision', label: 'Actual Farmer Decision' },
      { name: 'notes', label: 'Observer Notes', type: 'textarea', full: true },
    ],
    filters: [
      { k: 'response', options: RESPONSES, label: 'response' },
      { k: 'consumption', options: CONSUMPTION, label: 'consumption' },
    ],
    cols: [
      ['Pond', (r) => r.pond?.code || ''], ['Date', fmt], ['Feed', 'feedType'],
      ['Amount', (r) => num(r.amount, r.unit)],
      ['Before', 'activityBefore'], ['During', 'activityDuring'], ['After', 'activityAfter'],
      ['Response', 'response'], ['Consumption', 'consumption'],
    ],
  },

  'feeding-trays': {
    title: 'Feeding Tray Observation (optional — mainly shrimp)', endpoint: '/api/feeding-trays', farmer: true,
    fields: [
      ...dt,
      { name: 'trayId', label: 'Tray ID', hint: 'multiple trays per pond allowed' },
      { name: 'feedGiven', label: 'Feed Given (g)', type: 'number' },
      { name: 'remainingFeed', label: 'Remaining Feed (g)', type: 'number' },
      { name: 'consumption', label: 'Estimated Consumption', type: 'select', options: CONSUMPTION },
      { name: 'observationMin', label: 'Observation Time (min)', type: 'number' },
      { name: 'trayCondition', label: 'Tray Condition', type: 'select', options: ['Clean', 'Fouled', 'Damaged'] },
      { name: 'notes', label: 'Observer Notes', type: 'textarea', full: true },
    ],
    filters: [{ k: 'trayId', label: 'tray' }],
    cols: [
      ['Pond', (r) => r.pond?.code || ''], ['Date', fmt], ['Tray', 'trayId'],
      ['Given', 'feedGiven'], ['Remaining', 'remainingFeed'], ['Consumption', 'consumption'],
    ],
  },

  environmental: {
    title: 'Environmental Observation', endpoint: '/api/environmental',
    fields: [
      ...dt,
      { name: 'airTemp', label: 'Air Temperature (°C)', type: 'number' },
      { name: 'rainfall', label: 'Rainfall', type: 'select', options: RAIN },
      { name: 'windCondition', label: 'Wind Condition', type: 'select', options: WIND },
      { name: 'cloudCondition', label: 'Cloud Condition', type: 'select', options: ['Clear', 'Partly cloudy', 'Overcast'] },
      { name: 'sunlight', label: 'Sunlight Condition', type: 'select', options: ['Sunny', 'Hazy', 'Cloudy'] },
      { name: 'aeratorOn', label: 'Aerator ON/OFF', type: 'select', options: ['ON', 'OFF'] },
      { name: 'aeratorCount', label: 'Number of Aerators', type: 'number' },
      { name: 'aeratorRuntimeMin', label: 'Aerator Runtime (min)', type: 'number' },
      { name: 'aeratorNotes', label: 'Aerator Notes' },
      { name: 'notes', label: 'Weather Notes', type: 'textarea', full: true },
    ],
    cols: [
      ['Pond', (r) => r.pond?.code || ''], ['Date', fmt], ['Air °C', 'airTemp'],
      ['Rain', 'rainfall'], ['Wind', 'windCondition'],
      ['Aerator', (r) => `${r.aeratorOn || ''} ${r.aeratorCount || ''}`.trim()],
    ],
  },

  health: {
    title: 'Health Observation', endpoint: '/api/health', farmer: true, photo: true,
    note: 'Observation only — requires expert/farmer assessment. The system makes no medical/biological diagnosis.',
    fields: [
      ...dt,
      { name: 'speciesName', label: 'Species' },
      { name: 'mortalityCount', label: 'Mortality Count', type: 'number' },
      { name: 'observedCondition', label: 'Observed Health Condition', type: 'select', options: ['Normal', 'Lethargic', 'Gasping', 'Erratic swimming', 'Loss of appetite', 'Other'] },
      { name: 'unusualBehaviour', label: 'Unusual Behaviour' },
      { name: 'diseaseSymptoms', label: 'Disease Symptoms' },
      { name: 'waterCondition', label: 'Water Condition' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    cols: [
      ['Pond', (r) => r.pond?.code || ''], ['Date', fmt], ['Mortality', 'mortalityCount'],
      ['Condition', 'observedCondition'],
      ['Symptoms', (r) => (r.diseaseSymptoms || '').slice(0, 30)],
    ],
  },

  'daily-logs': {
    title: 'Daily Pond Log', endpoint: '/api/daily-logs', farmer: true, photo: true,
    note: 'Quick daily log — designed for phone entry.',
    fields: [
      { name: 'pondId', label: 'Pond', type: 'select', options: 'ponds', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'generalCondition', label: 'General Pond Condition', type: 'select', options: ['Good', 'Fair', 'Poor'] },
      { name: 'waterAppearance', label: 'Water Appearance', type: 'select', options: ['Clear', 'Greenish', 'Brownish', 'Murky', 'Other'] },
      { name: 'waterOdour', label: 'Water Odour', type: 'select', options: ['None', 'Earthy', 'Rotten/putrid', 'Other'] },
      { name: 'surfaceActivity', label: 'Surface Activity', type: 'select', options: ACTIVITY_LEVELS },
      { name: 'feedResponse', label: 'Feed Response', type: 'select', options: RESPONSES },
      { name: 'mortalityCount', label: 'Mortality Count', type: 'number' },
      { name: 'aeratorStatus', label: 'Aerator Status', type: 'select', options: ['ON', 'OFF'] },
      { name: 'weather', label: 'Weather', type: 'select', options: WEATHER },
      { name: 'rainfall', label: 'Rainfall', type: 'select', options: RAIN },
      { name: 'diseaseSymptoms', label: 'Disease Symptoms' },
      { name: 'unusualEvents', label: 'Unusual Events' },
      { name: 'notes', label: 'General Notes', type: 'textarea', full: true },
    ],
    cols: [
      ['Pond', (r) => r.pond?.code || ''], ['Date', fmtDate],
      ['Condition', 'generalCondition'], ['Water', 'waterAppearance'],
      ['Mortality', 'mortalityCount'], ['Notes', (r) => (r.notes || '').slice(0, 30)],
    ],
  },

  feedback: {
    title: 'Farmer Feedback', endpoint: '/api/feedback',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'pondId', label: 'Pond', type: 'select', options: 'ponds' },
      { name: 'observer', label: 'Farmer/Observer' },
      { name: 'problem', label: 'Problem', type: 'textarea', full: true },
      { name: 'currentPractice', label: 'Current Practice', full: true },
      { name: 'equipmentUsed', label: 'Equipment Used' },
      { name: 'mainDifficulty', label: 'Main Difficulty', type: 'textarea', full: true },
      { name: 'desiredImprovement', label: 'Desired Improvement', type: 'textarea', full: true },
      { name: 'opinionAutoFeeding', label: 'Opinion on Automatic Feeding', type: 'select', options: ['Positive', 'Neutral', 'Negative', 'Unsure'] },
      { name: 'opinionMonitoring', label: 'Opinion on Monitoring', type: 'select', options: ['Positive', 'Neutral', 'Negative', 'Unsure'] },
      { name: 'notes', label: 'Additional Notes', type: 'textarea', full: true },
    ],
    cols: [
      ['Date', fmtDate], ['Pond', (r) => r.pond?.code || ''], ['Observer', 'observer'],
      ['Problem', (r) => (r.problem || '').slice(0, 30)], ['Auto-feed opinion', 'opinionAutoFeeding'],
    ],
  },

  visits: {
    title: 'Field Visits', endpoint: '/api/visits', photo: true,
    fields: [
      { name: 'date', label: 'Visit Date', type: 'date', required: true },
      { name: 'location', label: 'Location' },
      { name: 'pondId', label: 'Pond', type: 'select', options: 'ponds' },
      { name: 'observer', label: 'Observer' },
      { name: 'purpose', label: 'Purpose', type: 'select', options: ['Measurement collection', 'Sensor installation', 'Farmer meeting', 'Training', 'Other'] },
      { name: 'measurementsCollected', label: 'Measurements Collected', type: 'textarea', full: true },
      { name: 'activitiesObserved', label: 'Activities Observed', type: 'textarea', full: true },
      { name: 'farmerFeedback', label: 'Farmer Feedback', type: 'textarea', full: true },
      { name: 'problemsIdentified', label: 'Problems Identified', type: 'textarea', full: true },
      { name: 'followUpRequired', label: 'Follow-up Required?', type: 'checkbox' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    cols: [
      ['Date', fmtDate], ['Pond', (r) => r.pond?.code || ''], ['Observer', 'observer'],
      ['Purpose', 'purpose'], ['Follow-up', (r) => (r.followUpRequired ? 'YES' : '')],
    ],
  },

  experiments: {
    title: 'Experiments', endpoint: '/api/experiments',
    fields: [
      { name: 'name', label: 'Experiment Name', required: true, full: true },
      { name: 'objective', label: 'Objective', type: 'textarea', full: true, hint: 'e.g. Activity signal validation during feeding' },
      { name: 'pondId', label: 'Pond', type: 'select', options: 'ponds' },
      { name: 'speciesName', label: 'Species' },
      { name: 'startDate', label: 'Start Date', type: 'date' },
      { name: 'endDate', label: 'End Date', type: 'date' },
      { name: 'sensorSetup', label: 'Sensor Setup' },
      { name: 'sensorPosition', label: 'Activity Sensor Position' },
      { name: 'feedingMethod', label: 'Feeding Method' },
      { name: 'status', label: 'Status', type: 'select', options: ['PLANNED', 'ACTIVE', 'COMPLETED'] },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    cols: [
      ['Name', 'name'], ['Pond', (r) => r.pond?.code || ''],
      ['Status', 'status'], ['Start', (r) => (r.startDate || '').slice(0, 10)],
    ],
  },
};