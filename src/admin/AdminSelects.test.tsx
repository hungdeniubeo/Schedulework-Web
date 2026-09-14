import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScheduleEntry, ShiftType } from "../scheduling/types";
import { AdminScheduler, EntryEditor } from "./AdminScheduler";
import { WeekManager } from "./WeekManager";
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
  it("does not fall back to a browser-native confirmation dialog", () => {
    expect(adminSchedulerSource).not.toContain("window.confirm");
  });

  it("uses the shared keyboard-safe modal backdrop", () => {
    expect(adminSchedulerSource).not.toContain('className="modal-backdrop"');
    expect(submissionDialogSource).not.toContain('className="modal-backdrop"');
  });
});
