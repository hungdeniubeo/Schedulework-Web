export type EmployeeAccessProfile = {
  role: "admin" | "employee";
  must_change_password: boolean;
};

export function hasEmployeeAccess(
  profile: EmployeeAccessProfile | null,
  active: boolean,
): boolean {
  return profile?.role === "employee" && active;
}

export function employeeDestination(profile: EmployeeAccessProfile): string {
  return profile.must_change_password
    ? "/change-password"
    : "/app/availability";
}
