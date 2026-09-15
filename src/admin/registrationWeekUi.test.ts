import { describe, expect, it } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import {
  registrationWeekActionState,
  registrationWeekStatusLabel,
  validateRegistrationWeek,
} from "./registrationWeekUi";

const existingWeek: RegistrationWeek = {
  id: "week-1",
  week_start: "2026-09-28",
  lock_at: "2026-09-25T15:00:00.000Z",
  status: "open",
  created_at: "",
  updated_at: "",
};

describe("registration week management rules", () => {
  it("maps effective statuses and valid actions without exposing enums", () => {
    expect(registrationWeekStatusLabel("open", false)).toBe("Đang mở");
    expect(registrationWeekStatusLabel("locked", true)).toBe("Đã khóa");
    expect(registrationWeekStatusLabel("archived", true)).toBe("Đã lưu trữ");
    expect(registrationWeekActionState("open", false)).toEqual({
      canEditDeadline: true,
      canLock: true,
      canReopen: false,
      canArchive: true,
      canDelete: true,
    });
    expect(registrationWeekActionState("locked", true).canReopen).toBe(true);
    expect(registrationWeekActionState("archived", true)).toEqual({
      canEditDeadline: false,
      canLock: false,
      canReopen: false,
      canArchive: false,
      canDelete: true,
    });
  });

  it("rejects non-Monday and duplicate registration weeks", () => {
    expect(validateRegistrationWeek("2026-09-29", [existingWeek])).toBe(
      "Ngày bắt đầu tuần phải là Thứ Hai.",
    );
    expect(validateRegistrationWeek("2026-09-28", [existingWeek])).toBe(
      "Tuần đăng ký này đã tồn tại.",
    );
    expect(validateRegistrationWeek("2026-10-05", [existingWeek])).toBeNull();
  });
});
