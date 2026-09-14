import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScheduleEntry, ShiftType } from "../scheduling/types";
import {
  AdminScheduler,
  EntryEditor,
  scheduleWeekStatusLabel,
} from "./AdminScheduler";
import {
  WeekManager,
  registrationWeekActionState,
  registrationWeekStatusLabel,
} from "./WeekManager";
import adminSchedulerSource from "./AdminScheduler.tsx?raw";
import submissionDialogSource from "./SubmissionDialog.tsx?raw";

const shift: ShiftType = {
  id: "morning",
  label: "10:00-14:00",
  color: "#0f766e",
  isPreset: true,
};

const entry: ScheduleEntry = {
  id: "entry-1",
  scheduleWeekId: "week-1",
  employeeId: "employee-1",
  dayOfWeek: 1,
  shiftTypeId: shift.id,
  customStart: null,
  customEnd: null,
  customLabel: null,
  sortOrderInCell: 0,
};

describe("Admin desktop selects", () => {
  it("uses the shared custom control for registration weeks", () => {
    const html = renderToStaticMarkup(
      <WeekManager
        weeks={[]}
        selectedId=""
        busy={false}
        onSelect={() => undefined}
        onCreate={async () => undefined}
        onUpdate={async () => undefined}
      />,
    );

    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Tuần đang xem"');
  });

  it("renders selected registration-week details fully in Vietnamese", () => {
    const html = renderToStaticMarkup(
      <WeekManager
        weeks={[
          {
            id: "week-1",
            week_start: "2026-09-28",
            lock_at: "2099-09-25T15:00:00.000Z",
            status: "open",
            created_at: "",
            updated_at: "",
          },
        ]}
        selectedId="week-1"
        busy={false}
        onSelect={() => undefined}
        onCreate={async () => undefined}
        onUpdate={async () => undefined}
      />,
    );

    expect(html).toContain("Tuần 28/09 – 04/10");
    expect(html).toContain("Đang mở");
    expect(html).toContain("Ngày giờ khóa đăng ký");
    expect(html).toContain("Cập nhật hạn đăng ký");
    expect(html).toContain("Khóa đăng ký");
    expect(html).toContain("Mở lại đăng ký");
    expect(html).toContain("Lưu trữ");
    expect(html).not.toContain(">open<");
    expect(html).not.toContain("Lock now");
  });

  it("maps status labels and action availability without exposing enums", () => {
    expect(registrationWeekStatusLabel("open", false)).toBe("Đang mở");
    expect(registrationWeekStatusLabel("locked", true)).toBe("Đã khóa");
    expect(registrationWeekStatusLabel("archived", true)).toBe("Đã lưu trữ");
    expect(registrationWeekActionState("open", false)).toEqual({
      canEditDeadline: true,
      canLock: true,
      canReopen: false,
      canArchive: true,
    });
    expect(registrationWeekActionState("locked", true).canReopen).toBe(true);
    expect(registrationWeekActionState("archived", true)).toEqual({
      canEditDeadline: false,
      canLock: false,
      canReopen: false,
      canArchive: false,
    });
  });

  it("uses custom controls for scheduler filters", () => {
    const html = renderToStaticMarkup(<AdminScheduler />);

    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Tuần xếp lịch"');
    expect(html).toContain('aria-label="Lọc theo nhóm"');
  });

  it("uses the shared custom control in the shift editor dialog", () => {
    const html = renderToStaticMarkup(
      <EntryEditor
        entry={entry}
        shifts={[shift]}
        entries={[entry]}
        saving={false}
        onClose={() => undefined}
        onSave={async () => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Loại ca"');
  });
});

describe("Admin scheduler confirmations", () => {
  it("maps schedule statuses to Vietnamese labels", () => {
    expect(scheduleWeekStatusLabel("draft")).toBe("Bản nháp");
    expect(scheduleWeekStatusLabel("published")).toBe("Đã công bố");
    expect(scheduleWeekStatusLabel("archived")).toBe("Đã lưu trữ");
    expect(adminSchedulerSource).not.toContain(">Archive<");
    expect(adminSchedulerSource).not.toContain("label: `${formatWeekRange(item.weekStart)} · ${item.status}`");
  });

  it("does not fall back to a browser-native confirmation dialog", () => {
    expect(adminSchedulerSource).not.toContain("window.confirm");
  });

  it("uses the shared keyboard-safe modal backdrop", () => {
    expect(adminSchedulerSource).not.toContain('className="modal-backdrop"');
    expect(submissionDialogSource).not.toContain('className="modal-backdrop"');
  });
});
