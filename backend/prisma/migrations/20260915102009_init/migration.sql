-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'RESEARCHER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Pond" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "speciesId" TEXT,
    "areaValue" REAL,
    "areaUnit" TEXT,
    "depthValue" REAL,
    "depthUnit" TEXT,
    "waterSource" TEXT,
    "stockingDate" DATETIME,
    "stockingDensity" REAL,
    "stockingCount" INTEGER,
    "cultureType" TEXT,
    "safetyConfig" TEXT,
    "feedingConfig" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pond_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeasurementParameter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "category" TEXT NOT NULL DEFAULT 'WATER_QUALITY',
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minExpected" REAL,
    "maxExpected" REAL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ESP32',
    "apiKey" TEXT NOT NULL,
    "pondId" TEXT,
    "lastHeartbeat" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "pendingCommand" TEXT,
    "commandAt" DATETIME,
    "commandTakenAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SensorMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "value" REAL,
    "textValue" TEXT,
    "unit" TEXT,
    "method" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "dataQuality" TEXT NOT NULL DEFAULT 'GOOD',
    "deviceId" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SensorMeasurement_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SensorMeasurement_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "MeasurementParameter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "durationMin" REAL,
    "activityLevel" TEXT,
    "feedingResponse" TEXT,
    "feedPresence" TEXT,
    "surfaceCondition" TEXT,
    "behaviour" TEXT,
    "weather" TEXT,
    "rainfall" TEXT,
    "wind" TEXT,
    "aeratorStatus" TEXT,
    "otherActivity" TEXT,
    "notes" TEXT,
    "experimentId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityRecord_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivitySignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "sensorId" TEXT,
    "rawSignal" REAL,
    "activityIndex" REAL,
    "durationSec" REAL,
    "quality" TEXT,
    "position" TEXT,
    "noise" TEXT,
    "deviceId" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivitySignal_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "feedType" TEXT,
    "amount" REAL,
    "unit" TEXT,
    "method" TEXT,
    "durationMin" REAL,
    "activityBefore" TEXT,
    "activityDuring" TEXT,
    "activityAfter" TEXT,
    "consumption" TEXT,
    "response" TEXT,
    "remainingFeed" TEXT,
    "weather" TEXT,
    "doBefore" REAL,
    "phBefore" REAL,
    "tempBefore" REAL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "aiDecisionId" TEXT,
    "actualDecision" TEXT,
    "notes" TEXT,
    "experimentId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeedingEvent_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedingTrayRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "trayId" TEXT,
    "feedGiven" REAL,
    "remainingFeed" REAL,
    "consumption" TEXT,
    "observationMin" REAL,
    "trayCondition" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeedingTrayRecord_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnvironmentalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "airTemp" REAL,
    "rainfall" TEXT,
    "windCondition" TEXT,
    "cloudCondition" TEXT,
    "sunlight" TEXT,
    "aeratorOn" TEXT,
    "aeratorCount" INTEGER,
    "aeratorRuntimeMin" REAL,
    "aeratorNotes" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EnvironmentalRecord_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "speciesName" TEXT,
    "mortalityCount" INTEGER,
    "observedCondition" TEXT,
    "unusualBehaviour" TEXT,
    "diseaseSymptoms" TEXT,
    "waterCondition" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HealthObservation_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyPondLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "generalCondition" TEXT,
    "waterAppearance" TEXT,
    "waterOdour" TEXT,
    "surfaceActivity" TEXT,
    "behaviour" TEXT,
    "feedResponse" TEXT,
    "mortalityCount" INTEGER,
    "aeratorStatus" TEXT,
    "weather" TEXT,
    "rainfall" TEXT,
    "diseaseSymptoms" TEXT,
    "unusualEvents" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyPondLog_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FarmerFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "pondId" TEXT,
    "observer" TEXT,
    "problem" TEXT,
    "currentPractice" TEXT,
    "equipmentUsed" TEXT,
    "mainDifficulty" TEXT,
    "desiredImprovement" TEXT,
    "opinionAutoFeeding" TEXT,
    "opinionMonitoring" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FarmerFeedback_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "location" TEXT,
    "pondId" TEXT,
    "observer" TEXT,
    "purpose" TEXT,
    "measurementsCollected" TEXT,
    "activitiesObserved" TEXT,
    "farmerFeedback" TEXT,
    "problemsIdentified" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldVisit_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "pondId" TEXT,
    "speciesName" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "sensorSetup" TEXT,
    "sensorPosition" TEXT,
    "feedingMethod" TEXT,
    "variables" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Experiment_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExperimentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doValue" REAL,
    "phValue" REAL,
    "tempValue" REAL,
    "activityIndex" REAL,
    "previousFeedAmount" REAL,
    "weather" TEXT,
    "mlRecommendation" TEXT,
    "safetyStatus" TEXT,
    "finalRecommendation" TEXT,
    "actualFeedGiven" REAL,
    "farmerOverride" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiDecision_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MlDataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "featureKeys" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "pondId" TEXT,
    "fromDate" DATETIME,
    "toDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NOT_TRAINED',
    "metrics" TEXT,
    "sampleCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MlLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT,
    "recordedAt" DATETIME,
    "refType" TEXT,
    "refId" TEXT,
    "summary" TEXT,
    "labelValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNLABELED',
    "notes" TEXT,
    "labeledById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MlLabel_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pondId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "recordId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Species_name_key" ON "Species"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Pond_code_key" ON "Pond"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementParameter_name_key" ON "MeasurementParameter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Device_apiKey_key" ON "Device"("apiKey");

-- CreateIndex
CREATE INDEX "SensorMeasurement_pondId_recordedAt_idx" ON "SensorMeasurement"("pondId", "recordedAt");

-- CreateIndex
CREATE INDEX "SensorMeasurement_parameterId_recordedAt_idx" ON "SensorMeasurement"("parameterId", "recordedAt");

-- CreateIndex
CREATE INDEX "ActivityRecord_pondId_recordedAt_idx" ON "ActivityRecord"("pondId", "recordedAt");

-- CreateIndex
CREATE INDEX "ActivitySignal_pondId_recordedAt_idx" ON "ActivitySignal"("pondId", "recordedAt");

-- CreateIndex
CREATE INDEX "FeedingEvent_pondId_recordedAt_idx" ON "FeedingEvent"("pondId", "recordedAt");

-- CreateIndex
CREATE INDEX "FeedingTrayRecord_pondId_recordedAt_idx" ON "FeedingTrayRecord"("pondId", "recordedAt");

-- CreateIndex
CREATE INDEX "EnvironmentalRecord_pondId_recordedAt_idx" ON "EnvironmentalRecord"("pondId", "recordedAt");

-- CreateIndex
CREATE INDEX "HealthObservation_pondId_recordedAt_idx" ON "HealthObservation"("pondId", "recordedAt");

-- CreateIndex
CREATE INDEX "DailyPondLog_pondId_date_idx" ON "DailyPondLog"("pondId", "date");

-- CreateIndex
CREATE INDEX "AiDecision_pondId_recordedAt_idx" ON "AiDecision"("pondId", "recordedAt");

-- CreateIndex
CREATE INDEX "MlLabel_status_idx" ON "MlLabel"("status");
