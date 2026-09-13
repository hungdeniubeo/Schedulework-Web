export const DAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const PERIODS = ["morning", "afternoon", "evening"] as const;
export type Period = (typeof PERIODS)[number];
export type AvailabilityStatus = "available" | "off";

export type DayAvailability = {
  status: AvailabilityStatus;
  periods: Period[];
  start: string | null;
  end: string | null;
};

export type Availability = {
  version: 1;
  days: Record<string, DayAvailability>;
};

export type RegistrationWeekStatus = "open" | "locked" | "archived";

export type ProfileRole = "admin" | "employee";

export type Profile = {
  user_id: string;
  role: ProfileRole;
  must_change_password: boolean;
  created_at: string;
};

export type EmployeePortalData = {
  employee: { id: string; name: string };
  week: {
    id: string;
    weekStart: string;
    lockAt: string;
    status: RegistrationWeekStatus;
    locked: boolean;
  };
  submission: {
    availability: Availability;
    note: string;
    submittedAt: string;
    updatedAt: string;
  } | null;
};

export type AdminEmployee = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type RegistrationWeek = {
  id: string;
  week_start: string;
  lock_at: string;
  status: RegistrationWeekStatus;
  created_at: string;
  updated_at: string;
};

export type AvailabilitySubmission = {
  id: string;
  week_id: string;
  employee_id: string;
  availability: Availability;
  note: string | null;
  submitted_at: string;
  updated_at: string;
};
