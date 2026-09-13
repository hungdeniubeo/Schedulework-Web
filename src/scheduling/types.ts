export type Group = {
  id: string;
  name: string;
  sortOrder: number;
};

export type CloudEmployee = {
  id: string;
  name: string;
  active: boolean;
  groupId: string | null;
  sortOrder: number;
  isHeadChef: boolean;
  isExecutiveChef: boolean;
  isManager: boolean;
  isFullTime: boolean;
  isNew: boolean;
  roleLabel: string | null;
};

export type ShiftType = {
  id: string;
  label: string;
  color: string;
  isPreset: boolean;
};

export type ScheduleWeekStatus = "draft" | "published" | "archived";

export type ScheduleWeek = {
  id: string;
  weekStart: string;
  status: ScheduleWeekStatus;
  publishedAt: string | null;
  countOverrides: Record<string, number>;
};

export type ScheduleEntry = {
  id: string;
  scheduleWeekId: string;
  employeeId: string;
  dayOfWeek: number;
  shiftTypeId: string;
  customStart: string | null;
  customEnd: string | null;
  customLabel: string | null;
  sortOrderInCell: number;
};
