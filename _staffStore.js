const seedStaff = [
  {
    employee_id: "DOC101",
    password: "temp123",
    role: "doctor",
    name: "Dr. Kumar",
    email: "doc101@jeevadrishti.local",
    phone: "9000011111",
    department: "Critical Care",
    first_login: false,
  },
  {
    employee_id: "NUR202",
    password: "temp123",
    role: "nurse",
    name: "Nurse Anjali",
    email: "nur202@jeevadrishti.local",
    phone: "9000022222",
    department: "General Ward",
    first_login: false,
  },
  {
    employee_id: "ADMIN1",
    password: "admin123",
    role: "admin",
    name: "Admin",
    email: "admin1@jeevadrishti.local",
    phone: "9000033333",
    department: "Operations",
    first_login: false,
  },
];

const globalStore = globalThis.__medconnectStaffStore ?? {
  staffDb: seedStaff,
  tokenStore: new Map(),
};

if (!globalThis.__medconnectStaffStore) {
  globalThis.__medconnectStaffStore = globalStore;
}

export function getStaffDb() {
  return globalStore.staffDb;
}

export function getTokenStore() {
  return globalStore.tokenStore;
}

export function updateStaffRole(employeeId, role) {
  const target = globalStore.staffDb.find((member) => member.employee_id === employeeId);
  if (!target) return null;
  target.role = role;
  return target;
}
