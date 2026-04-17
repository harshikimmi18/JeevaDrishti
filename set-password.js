import { getStaffDb, getTokenStore } from "./_staffStore.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ message: "token and password are required" });
  }

  const staffDb = getStaffDb();
  const tokenStore = getTokenStore();
  const employeeId = tokenStore.get(token);

  if (!employeeId) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  const user = staffDb.find((entry) => entry.employee_id === employeeId);

  if (!user) {
    tokenStore.delete(token);
    return res.status(404).json({ message: "Staff user not found" });
  }

  user.password = password;
  user.first_login = false;
  tokenStore.delete(token);

  return res.status(200).json({
    message: "Password set successfully",
    user: {
      employee_id: user.employee_id,
      name: user.name,
      role: user.role,
      password: user.password,
      first_login: user.first_login,
    },
  });
}
