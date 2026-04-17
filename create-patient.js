import { dispatchPatientCredentials } from "./_notificationStore.js";
import { createPatientRecord } from "./_patientStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    full_name,
    phone,
    contact_email,
    ward,
    bed_number,
    status,
    contact_mode,
  } = req.body || {};

  if (!full_name || !phone || !ward || !status) {
    return res.status(400).json({
      message: "full_name, phone, ward, and status are required",
    });
  }

  const patient = createPatientRecord({
    full_name: full_name.trim(),
    phone: phone.trim(),
    contact_email: contact_email?.trim() || null,
    ward,
    bed_number: bed_number?.trim() || "TBD",
    status,
    contact_mode: contact_mode || "Family mobile",
  });

  const delivery = await dispatchPatientCredentials({
    patient,
    contactPhone: phone.trim(),
    contactEmail: contact_email?.trim() || null,
    contactMode: contact_mode || "Family mobile",
  });

  return res.status(200).json({
    message: "Patient created",
    patient,
    credential_delivery: delivery,
  });
}
