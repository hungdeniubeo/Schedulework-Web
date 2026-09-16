import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import type {
  ScheduleEntry,
  ScheduleWeek,
  ShiftType,
} from "../scheduling/types";
import {
  AdminScheduler,
  EntryEditor,
  prepareScheduleWeekForEditing,
  selectScheduleWeekId,
  scheduleWeekStatusLabel,
} from "./AdminScheduler";
import { WeekManager } from "./WeekManager";
import {
  registrationWeekActionState,
  registrationWeekStatusLabel,
} from "./registrationWeekUi";
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

const createdRegistrationWeek: RegistrationWeek = {
  id: "created-week",
  week_start: "2026-10-05",
  lock_at: "2026-10-02T15:00:00.000Z",
  status: "open",
  created_at: "",
  updated_at: "",
};

const createWeekStub = async () => createdRegistrationWeek;

describe("Admin desktop selects", () => {
  it("uses the shared custom control for registration weeks", () => {
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
        onCreate={createWeekStub}
        onUpdate={async () => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Tuần đang quản lý"');
    expect(html).toContain("Quản lý tuần đăng ký");
    expect(html).toContain("Tạo tuần mới");
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
        onCreate={createWeekStub}
        onUpdate={async () => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(html).toContain("Bạn đang quản lý");
    expect(html).toContain("TUẦN 5 THÁNG 9 · 28/09 – 04/10");
    expect(html).toContain("Đang mở");
    expect(html).toContain("Thứ Sáu, 25/09/2099 · 22:00");
    expect(html).toContain("Chỉnh sửa tuần");
    expect(html).toContain("Khóa đăng ký");
    expect(html).toContain("Lưu trữ");
    expect(html).toContain("Xóa tuần");
    expect(html).not.toContain("Mở lại đăng ký");
    expect(html).not.toContain('type="datetime-local"');
    expect(html).not.toContain("Cập nhật hạn đăng ký");
    expect(html).not.toContain(">open<");
    expect(html).not.toContain("Lock now");
  });

  it("only renders actions that are valid for locked and archived weeks", () => {
    const baseWeek = {
      id: "week-1",
      week_start: "2026-09-28",
      lock_at: "2026-09-25T15:00:00.000Z",
      created_at: "",
      updated_at: "",
    };
    const lockedHtml = renderToStaticMarkup(
      <WeekManager
        weeks={[{ ...baseWeek, status: "locked" }]}
        selectedId="week-1"
        busy={false}
        onSelect={() => undefined}
        onCreate={createWeekStub}
        onUpdate={async () => undefined}
        onDelete={async () => undefined}
      />,
    );
    const archivedHtml = renderToStaticMarkup(
      <WeekManager
        weeks={[{ ...baseWeek, status: "archived" }]}
        selectedId="week-1"
        busy={false}
        onSelect={() => undefined}
        onCreate={createWeekStub}
        onUpdate={async () => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(lockedHtml).toContain("Mở lại đăng ký");
    expect(lockedHtml).not.toContain("Khóa đăng ký");
    expect(archivedHtml).toContain("Đã lưu trữ");
    expect(archivedHtml).toContain("Tuần đã lưu trữ");
    expect(archivedHtml).not.toContain("Mở lại đăng ký");
    expect(archivedHtml).not.toContain("Khóa đăng ký");
    expect(archivedHtml).not.toContain("Chỉnh sửa tuần");
    expect(archivedHtml).not.toContain(">Lưu trữ<");
    expect(archivedHtml).toContain(">Xóa tuần</button>");
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

  it("uses custom controls for scheduler filters", () => {
    const html = renderToStaticMarkup(<AdminScheduler />);

    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Tuần xếp lịch"');
    expect(html).toContain('aria-label="Lọc theo nhóm"');
  });

  it("keeps week creation outside the frequently used schedule filters", () => {
    const html = renderToStaticMarkup(<AdminScheduler />);

    expect(html).toContain('aria-label="Tạo lịch tuần mới"');
    expect(html).not.toContain('aria-label="Tuần bắt đầu từ Thứ Hai"');
  });

  it("gives each schedule filter a visible label", () => {
    const html = renderToStaticMarkup(<AdminScheduler />);

    expect(html).toContain("Tuần đang xem");
    expect(html).toContain("Tìm nhân viên");
    expect(html).toContain("Nhóm nhân viên");
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
    expect(html).not.toContain('type="time"');
    expect(html).toContain('placeholder="HH:mm"');
    expect(html).toContain('aria-label="Loại ca"');
  });
});

describe("Admin scheduler confirmations", () => {
  it("keeps the schedule week synchronized with the selected registration week", () => {
    const scheduleWeeks = [
      {
        id: "schedule-a",
        weekStart: "2026-09-14",
        status: "draft" as const,
        publishedAt: null,
        countOverrides: {},
      },
      {
        id: "schedule-b",
        weekStart: "2026-09-21",
        status: "draft" as const,
        publishedAt: null,
        countOverrides: {},
      },
    ];

    expect(selectScheduleWeekId(scheduleWeeks, "schedule-a", "2026-09-21")).toBe(
      "schedule-b",
    );
    expect(selectScheduleWeekId(scheduleWeeks, "schedule-a", "2026-09-28")).toBe(
      "",
    );
  });

  it("maps schedule statuses to Vietnamese labels", () => {
    expect(scheduleWeekStatusLabel("draft")).toBe("Bản nháp");
    expect(scheduleWeekStatusLabel("published")).toBe("Đã công bố");
    expect(scheduleWeekStatusLabel("archived")).toBe("Đã lưu trữ");
    expect(adminSchedulerSource).not.toContain(">Archive<");
    expect(adminSchedulerSource).not.toContain(
      "label: `${formatWeekRange(item.weekStart)} · ${item.status}`",
    );
  });

  it("lets the first edit reopen a published schedule as a draft", async () => {
    const publishedWeek: ScheduleWeek = {
      id: "schedule-published",
      weekStart: "2026-09-21",
      status: "published",
      publishedAt: "2026-09-20T10:00:00.000Z",
      countOverrides: {},
    };
    const updateStatus = vi.fn(async () => undefined);

    await expect(
      prepareScheduleWeekForEditing(publishedWeek, updateStatus),
    ).resolves.toEqual({ ...publishedWeek, status: "draft" });
    expect(updateStatus).toHaveBeenCalledWith(publishedWeek.id, "draft");
  });

  it("lets the first edit reopen an archived schedule as a draft", async () => {
    const archivedWeek: ScheduleWeek = {
      id: "schedule-archived",
      weekStart: "2026-09-21",
      status: "archived",
      publishedAt: null,
      countOverrides: {},
    };
    const updateStatus = vi.fn(async () => undefined);

    await expect(
      prepareScheduleWeekForEditing(archivedWeek, updateStatus),
    ).resolves.toEqual({ ...archivedWeek, status: "draft" });
    expect(updateStatus).toHaveBeenCalledWith(archivedWeek.id, "draft");
  });

  it("does not fall back to a browser-native confirmation dialog", () => {
    expect(adminSchedulerSource).not.toContain("window.confirm");
  });

  it("uses the shared keyboard-safe modal backdrop", () => {
    expect(adminSchedulerSource).not.toContain('className="modal-backdrop"');
    expect(submissionDialogSource).not.toContain('className="modal-backdrop"');
  });
});
