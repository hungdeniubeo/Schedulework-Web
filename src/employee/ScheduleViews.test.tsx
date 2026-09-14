import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import { MyScheduleContent, SubmittedAvailability } from "./ScheduleViews";

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
    expect(html).toContain("Ghi chú cũ");
    expect(html).toContain("Ghi chú từ phiên bản cũ");
  });
});

describe("My Schedule responsibility", () => {
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
