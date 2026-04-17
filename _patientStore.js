import { fakePatients } from "../src/data/fakePatients.js";

const seededPatients = fakePatients.map((patient, index) => ({
  ...patient,
  id: patient.patient_id,
  alerts: patient.status === "Critical" ? 2 : patient.status === "Under Observation" ? 1 : 0,
  updates_today: 3 + (index % 4),
  assigned_staff: index % 2 === 0 ? "Critical Care Team" : "Ward Operations",
  vitals: {
    heart_rate: 68 + index * 4,
    oxygen_saturation: patient.status === "Critical" ? 90 : 97,
    temperature: 98.1 + index * 0.2,
  },
}));

const store = globalThis.__medconnectPatientStore ?? {
  patients: seededPatients,
  lastTick: Date.now(),
  timeline: [
    {
      id: "seed-1",
      patient: "Rajesh Kumar",
      message: "Ventilation review completed and escalation note shared.",
      owner: "Critical Care Team",
      time: new Date().toISOString(),
    },
    {
      id: "seed-2",
      patient: "Anita Sharma",
      message: "Recovery plan updated after ward round.",
      owner: "Ward Operations",
      time: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
    },
    {
      id: "seed-3",
      patient: "Ravi Teja",
      message: "Family update pushed to patient portal with latest vitals.",
      owner: "Family Liaison Desk",
      time: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    },
  ],
};

if (!globalThis.__medconnectPatientStore) {
  globalThis.__medconnectPatientStore = store;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function maybeAddTimelineEvent(patient) {
  if (Math.random() > 0.35) return;

  const messages = [
    "Vitals reviewed and triage score recalculated.",
    "Doctor round completed and treatment note published.",
    "Nursing update synced with patient record.",
    "Family portal summary refreshed with latest observations.",
    "Medication administration confirmed by floor staff.",
  ];

  store.timeline.unshift({
    id: `${patient.patient_id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patient: patient.full_name,
    message: randomFrom(messages),
    owner: patient.assigned_staff,
    time: new Date().toISOString(),
  });

  store.timeline = store.timeline.slice(0, 8);
}

export function tickPatients() {
  const now = Date.now();
  const secondsSinceLastTick = Math.floor((now - store.lastTick) / 1000);

  if (secondsSinceLastTick < 5) {
    return store;
  }

  const rounds = Math.min(3, Math.floor(secondsSinceLastTick / 5));

  for (let round = 0; round < rounds; round += 1) {
    store.patients = store.patients.map((patient) => {
      const oxygenShift = Math.floor(Math.random() * 5) - 2;
      const heartShift = Math.floor(Math.random() * 11) - 5;
      const tempShift = (Math.floor(Math.random() * 5) - 2) * 0.1;

      const oxygen = clamp(patient.vitals.oxygen_saturation + oxygenShift, 86, 100);
      const heartRate = clamp(patient.vitals.heart_rate + heartShift, 52, 128);
      const temperature = clamp(Number((patient.vitals.temperature + tempShift).toFixed(1)), 97.1, 102.4);

      let status = patient.status;
      if (oxygen < 91 || heartRate > 115 || temperature > 100.8) {
        status = "Critical";
      } else if (oxygen < 95 || temperature > 99.6) {
        status = "Under Observation";
      } else {
        status = "Stable";
      }

      const healthScoreBase =
        status === "Critical" ? 42 : status === "Under Observation" ? 68 : 83;
      const health_score = clamp(healthScoreBase + Math.floor(Math.random() * 7) - 3, 28, 96);

      const alerts =
        status === "Critical" ? 2 + Math.floor(Math.random() * 2) : status === "Under Observation" ? 1 : 0;

      const nextPatient = {
        ...patient,
        status,
        alerts,
        health_score,
        updates_today: patient.updates_today + (Math.random() > 0.55 ? 1 : 0),
        vitals: {
          heart_rate: heartRate,
          oxygen_saturation: oxygen,
          temperature,
        },
      };

      maybeAddTimelineEvent(nextPatient);
      return nextPatient;
    });
  }

  store.lastTick = now;
  return store;
}

export function getPatientSnapshot() {
  return tickPatients();
}

function nextPatientId() {
  const maxNumericId = store.patients.reduce((max, patient) => {
    const numeric = Number(String(patient.patient_id || "").replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `PAT${String(maxNumericId + 1).padStart(3, "0")}`;
}

function nextPassword() {
  return `temp${Math.floor(1000 + Math.random() * 9000)}`;
}

export function createPatientRecord({
  full_name,
  phone,
  contact_email,
  ward,
  bed_number,
  status,
  contact_mode,
}) {
  const patient_id = nextPatientId();
  const password = nextPassword();
  const alerts = status === "Critical" ? 2 : status === "Under Observation" ? 1 : 0;
  const health_score = status === "Critical" ? 42 : status === "Under Observation" ? 65 : 78;

  const patient = {
    id: patient_id,
    patient_id,
    password,
    full_name,
    phone,
    contact_email,
    ward,
    bed_number: bed_number || "TBD",
    status,
    health_score,
    alerts,
    updates_today: 1,
    assigned_staff:
      ward === "ICU" || status === "Critical" ? "Critical Care Team" : "Ward Operations",
    contact_mode,
    vitals: {
      heart_rate: status === "Critical" ? 112 : 74,
      oxygen_saturation: status === "Critical" ? 90 : status === "Under Observation" ? 94 : 98,
      temperature: status === "Critical" ? 100.4 : 98.4,
    },
  };

  store.patients.unshift(patient);
  store.timeline.unshift({
    id: `${patient_id}-admit-${Date.now()}`,
    patient: full_name,
    message: `Patient admitted to ${ward} / Bed ${patient.bed_number} and family credentials prepared.`,
    owner: "Admissions Desk",
    time: new Date().toISOString(),
  });
  store.timeline = store.timeline.slice(0, 10);

  return patient;
}
