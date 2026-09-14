import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import { AvailabilityEditor } from "./AvailabilityEditor";

describe("AvailabilityEditor mobile controls", () => {
  it("renders preset and every Full interval hour as custom picker triggers", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("full");

    const html = renderToStaticMarkup(
      <AvailabilityEditor
        value={availability}
        weekStart="2026-09-14"
        onChange={() => undefined}
      />,
    );

    expect(html).not.toContain("<select");
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Ca Thứ 2"');
    expect(html).toContain('aria-label="Giờ bắt đầu Thứ 2 khoảng 1"');
    expect(html).toContain('aria-label="Giờ kết thúc Thứ 2 khoảng 1"');
    expect(html).toContain('aria-label="Giờ bắt đầu Thứ 2 khoảng 2"');
    expect(html).toContain('aria-label="Giờ kết thúc Thứ 2 khoảng 2"');
  });

  it("shows a compact reason only for off days", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "off",
      preset: null,
      intervals: [],
      offReason: "Em có lịch học",
    };
    availability.days["2"] = createPresetDay("morning");

    const html = renderToStaticMarkup(
      <AvailabilityEditor
        value={availability}
        weekStart="2026-09-14"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Lý do nghỉ Thứ 2"');
    expect(html).toContain("Em có lịch học");
    expect(html).not.toContain('aria-label="Lý do nghỉ Thứ 3"');
    expect(html).toContain('maxLength="120"');
  });
});
