import { describe, expect, it } from "vitest";
import {
  formatSubmissionStatus,
  getSaveSuccessMessage,
  legacyGlobalNoteForSave,
} from "./EmployeeRegistrationPage";

describe("employee availability save feedback", () => {
  it("distinguishes first submission and update success", () => {
    expect(getSaveSuccessMessage(false)).toBe("Đăng ký lịch thành công");
    expect(getSaveSuccessMessage(true)).toBe("Cập nhật đăng ký thành công");
  });

  it("shows the persisted submitted or updated time", () => {
    const base = {
      availability: { version: 2 as const, days: {} },
      note: "",
      submittedAt: "2026-09-14T04:30:00Z",
      updatedAt: "2026-09-14T04:30:00Z",
    };
    expect(formatSubmissionStatus(base)).toBe("Đã gửi lúc 11:30");
    expect(
      formatSubmissionStatus({ ...base, updatedAt: "2026-09-14T05:45:00Z" }),
    ).toBe("Đã cập nhật lúc 12:45");
  });

  it("preserves an existing global note without assigning it to a day", () => {
    expect(
      legacyGlobalNoteForSave({
        availability: { version: 2, days: {} },
        note: "Ghi chú lịch cũ",
        submittedAt: "2026-09-14T04:30:00Z",
        updatedAt: "2026-09-14T04:30:00Z",
      }),
    ).toBe("Ghi chú lịch cũ");
    expect(legacyGlobalNoteForSave(null)).toBe("");
  });
});
