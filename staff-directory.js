import { getStaffDb, updateStaffRole } from "./_staffStore.js";

function toDirectoryEntry(member) {
  return {
    id: member.employee_id,
    employee_id: member.employee_id,
    full_name: member.name,
    email: member.email || `${member.employee_id.toLowerCase()}@jeevadrishti.local`,
    role: member.role,
    unit: member.department || "Assigned Department",
    status: member.first_login ? "Pending" : "Active",
  };
}

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      users: getStaffDb().map(toDirectoryEntry),
    });
  }

  if (req.method === "PATCH") {
    const { employee_id, role } = req.body || {};

    if (!employee_id || !role) {
      return res.status(400).json({ message: "employee_id and role are required" });
    }

    const updated = updateStaffRole(employee_id, role);

    if (!updated) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    return res.status(200).json({
      user: toDirectoryEntry(updated),
    });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
