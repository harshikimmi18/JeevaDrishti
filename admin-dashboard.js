import { getPatientSnapshot } from "./_patientStore.js";

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const snapshot = getPatientSnapshot();
  const patients = snapshot.patients;
  const criticalPatients = patients.filter((patient) => patient.status === "Critical");
  const observationPatients = patients.filter(
    (patient) => patient.status === "Under Observation"
  );
  const stablePatients = patients.filter((patient) => patient.status === "Stable");

  const overviewStats = [
    {
      label: "Patients under watch",
      value: String(patients.length),
      delta: `${observationPatients.length + criticalPatients.length} active watchlist`,
    },
    {
      label: "Critical alerts",
      value: String(criticalPatients.reduce((sum, patient) => sum + patient.alerts, 0)),
      delta: `${criticalPatients.length} patients unstable`,
    },
    {
      label: "Staff coverage",
      value: `${Math.max(88, 100 - criticalPatients.length * 2)}%`,
      delta: `${stablePatients.length} patients stable`,
    },
    {
      label: "Updates closed",
      value: String(snapshot.timeline.length + patients.reduce((sum, patient) => sum + patient.updates_today, 0)),
      delta: `${patients.reduce((sum, patient) => sum + patient.updates_today, 0)} updates today`,
    },
  ];

  const priorityQueue = criticalPatients.slice(0, 3).map((patient, index) => ({
    title: `${patient.ward} alert for ${patient.full_name}`,
    detail: `SpO2 ${patient.vitals.oxygen_saturation}% · HR ${patient.vitals.heart_rate} bpm · Bed ${patient.bed_number}`,
    owner: patient.assigned_staff,
    urgency: index === 0 ? "Immediate" : index === 1 ? "High" : "Today",
    style:
      index === 0
        ? "border-rose-200 bg-rose-50/70"
        : index === 1
          ? "border-amber-200 bg-amber-50/80"
          : "border-cyan-200 bg-cyan-50/70",
  }));

  const liveFeed = snapshot.timeline.slice(0, 4).map((event) => ({
    patient: event.patient,
    message: event.message,
    time: formatTime(event.time),
  }));

  const wards = [...new Set(patients.map((patient) => patient.ward))];
  const wardCapacity = wards.map((ward, index) => {
    const wardPatients = patients.filter((patient) => patient.ward === ward);
    const load = Math.min(96, 40 + wardPatients.length * 12 + index * 7);
    const colors = ["#f97316", "#06b6d4", "#10b981", "#ef4444", "#8b5cf6"];

    return {
      name: ward,
      load,
      color: colors[index % colors.length],
    };
  });

  const responseCurve = [
    { time: "06:00", alerts: 4, resolved: 3 },
    { time: "09:00", alerts: 7, resolved: 5 },
    { time: "12:00", alerts: 9, resolved: 7 },
    { time: "15:00", alerts: 8, resolved: 9 },
    { time: "18:00", alerts: 11, resolved: 8 },
    { time: "21:00", alerts: criticalPatients.length + observationPatients.length + 2, resolved: stablePatients.length + 1 },
  ];

  const systemSignals = [
    { label: "Ambulances incoming", value: String(2 + (criticalPatients.length % 5)).padStart(2, "0"), note: "next 45 min" },
    { label: "Pending discharges", value: String(stablePatients.length), note: "awaiting approval" },
    { label: "Available specialists", value: String(15 + observationPatients.length), note: "on active roster" },
    { label: "System health", value: `${(98.4 + stablePatients.length * 0.1).toFixed(1)}%`, note: "sync stable" },
  ];

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    overviewStats,
    responseCurve,
    wardCapacity,
    priorityQueue,
    liveFeed,
    systemSignals,
  });
}
