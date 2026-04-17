import { dispatchStaffCredentials } from "./_notificationStore.js";
import { getStaffDb, getTokenStore } from "./_staffStore.js";

function getOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { name, role, phone, email, department, shift, contact_mode } = req.body || {};

  if (!name || !role || !phone) {
    return res.status(400).json({ message: "name, role, and phone are required" });
  }

  const staffDb = getStaffDb();
  const tokenStore = getTokenStore();
  const prefix = role === "doctor" ? "DOC" : role === "nurse" ? "NUR" : "ADM";
  const employeeId = `${prefix}${staffDb.length + 100}`;
  const token = crypto.randomUUID();
  const setupLink = `${getOrigin(req)}/setup-password?token=${token}`;

  const staff = {
    name,
    role,
    phone,
    email: email || null,
    department: department || "Assigned Department",
    shift: shift || "Flexible",
    employee_id: employeeId,
    password: null,
    first_login: true,
    setup_link: setupLink,
  };

  staffDb.push(staff);
  tokenStore.set(token, employeeId);

  const credential_delivery = await dispatchStaffCredentials({
    staff,
    contactPhone: phone,
    contactEmail: email,
    contactMode: contact_mode || "sms",
  });

  return res.status(200).json({
    message: "Staff created",
    employee_id: employeeId,
    setup_link: setupLink,
    credential_delivery,
  });
}
