import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import {
  MyScheduleContent,
  TeamScheduleContent,
  myScheduleRequestKey,
  SubmittedAvailability,
} from "./ScheduleViews";
import type { PublishedScheduleData } from "./scheduleApi";

describe("submitted availability display", () => {
  it("shows an off reason only on the matching off day", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "off",
      preset: null,
      intervals: [],
      offReason: "Em về quê",
    };
    availability.days["2"] = createPresetDay("morning");
    const html = renderToStaticMarkup(
      <SubmittedAvailability
        compact
        data={{
          weekStart: "2026-09-14",
          submission: {
            id: "submission-1",
            week_id: "week-1",
            employee_id: "employee-1",
            availability,
            note: "Ghi chú từ phiên bản cũ",
            submitted_at: "",
            updated_at: "",
          },
        }}
      />,
    );

    expect(html).toContain("Lý do: Em về quê");
    expect(html).toContain("Nghỉ");
    expect(html.match(/Lý do:/g)).toHaveLength(1);
    expect(html).toContain("10h–14h");
    expect(html).toContain("Tuần 3 tháng 9 · 14/09 – 20/09");
    expect(html).toContain("Ghi chú cũ");
    expect(html).toContain("Ghi chú từ phiên bản cũ");
  });

  it("separates the calendar date and work period for consistent rows", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning");
    const html = renderToStaticMarkup(
      <SubmittedAvailability
        data={{
          weekStart: "2026-09-14",
          submission: {
            id: "submission-1",
            week_id: "week-1",
            employee_id: "employee-1",
            availability,
            note: null,
            submitted_at: "",
            updated_at: "",
          },
        }}
      />,
    );

    expect(html).toContain('class="submitted-day-date"');
    expect(html).toContain('dateTime="2026-09-14"');
    expect(html).toContain('class="submitted-day-period"');
  });
});

describe("My Schedule responsibility", () => {
  it("changes its server request identity after a successful-save revision", () => {
    expect(myScheduleRequestKey("employee-1", 0)).not.toBe(
      myScheduleRequestKey("employee-1", 1),
    );
    expect(myScheduleRequestKey("employee-1", 1)).toBe("employee-1:1");
  });

  it("renders exactly one submitted availability section", () => {
    const html = renderToStaticMarkup(
      <MyScheduleContent
        data={{
          weekStart: "2026-09-14",
          submission: {
            id: "submission-1",
            week_id: "week-1",
            employee_id: "employee-1",
            availability: createEmptyAvailability(),
            note: null,
            submitted_at: "2026-09-14T04:30:00Z",
            updated_at: "2026-09-14T04:30:00Z",
          },
        }}
        onRegister={() => undefined}
      />,
    );

    expect(html.match(/submitted-schedule-section/g)).toHaveLength(1);
    expect(html).toContain("Lịch đã đăng ký");
    expect(html).toContain("Tuần 3 tháng 9 · 14/09 – 20/09");
    expect(html).not.toContain("Lịch chính thức");
  });

  it("shows a registration action when there is no submission", () => {
    const html = renderToStaticMarkup(
      <MyScheduleContent data={null} onRegister={() => undefined} />,
    );
    expect(html).toContain("Chưa có lịch đã đăng ký");
    expect(html).toContain("Đăng ký lịch");
  });
});

describe("published team schedule", () => {
  const data: PublishedScheduleData = {
    currentEmployeeId: "employee-1",
    week: {
      id: "week-1",
      weekStart: "2026-09-14",
      status: "published",
      publishedAt: "2026-09-13T08:00:00Z",
      countOverrides: {},
    },
    groups: [{ id: "group-1", name: "Bếp", sortOrder: 0 }],
    employees: [
      {
        id: "employee-1",
        name: "Nguyễn Phi Hùng",
        active: true,
        groupId: "group-1",
        positionId: null,
        positionName: null,
        sortOrder: 0,
        isNew: false,
      },
    ],
    shifts: [
      {
        id: "shift-1",
        label: "10:00-14:00",
        color: "#70AD47",
        isPreset: true,
      },
    ],
    entries: [
      {
        id: "entry-1",
        scheduleWeekId: "week-1",
        employeeId: "employee-1",
        dayOfWeek: 1,
        shiftTypeId: "shift-1",
        customStart: null,
        customEnd: null,
        customLabel: null,
        sortOrderInCell: 0,
      },
    ],
  };

  it("offers a full hidden schedule for image download without a personal marker", () => {
    const html = renderToStaticMarkup(<TeamScheduleContent data={data} />);
    const exportHtml = html.split('id="employee-published-schedule-export"')[1];

    expect(html).toContain("Tải ảnh lịch");
    expect(exportHtml).toBeDefined();
    expect(exportHtml).not.toContain(">Bạn<");
  });

  it("uses complete Vietnamese staffing period labels", () => {
    const html = renderToStaticMarkup(<TeamScheduleContent data={data} />);

    expect(html).toContain(">Sáng<");
    expect(html).toContain(">Trưa<");
    expect(html).toContain(">Tối<");
  });
});
