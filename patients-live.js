import { getPatientSnapshot } from "./_patientStore.js";

function getTrend(patient) {
  if (patient.status === "Critical") return "Escalating";
  if (patient.status === "Under Observation") return "Monitoring";
  return "Recovering";
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const snapshot = getPatientSnapshot();
  const patients = snapshot.patients.map((patient, index) => ({
    ...patient,
    diagnosis:
      patient.diagnosis ||
      (patient.status === "Critical"
        ? "Cardio-respiratory instability"
        : patient.status === "Under Observation"
          ? "Post-procedure monitoring"
          : "Recovery supervision"),
    age: patient.age || 34 + index * 6,
    gender: patient.gender || (index % 2 === 0 ? "Male" : "Female"),
    trend: getTrend(patient),
    risk_level:
      patient.status === "Critical"
        ? "High"
        : patient.status === "Under Observation"
          ? "Medium"
          : "Low",
  }));

  const critical = patients.filter((patient) => patient.status === "Critical");
  const observation = patients.filter(
    (patient) => patient.status === "Under Observation"
  );
  const stable = patients.filter((patient) => patient.status === "Stable");

  const summary = {
    totalPatients: patients.length,
    criticalCount: critical.length,
    observationCount: observation.length,
    stableCount: stable.length,
    avgHealthScore:
      Math.round(
        patients.reduce((sum, patient) => sum + patient.health_score, 0) /
          patients.length
      ) || 0,
  };

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    summary,
    patients: patients.sort((a, b) => {
      const priority = { Critical: 0, "Under Observation": 1, Stable: 2 };
      return (
        priority[a.status] - priority[b.status] ||
        a.health_score - b.health_score
      );
    }),
  });
}
