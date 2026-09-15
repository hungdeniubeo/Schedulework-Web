import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateTimePicker } from "./DateTimePicker";

describe("DateTimePicker", () => {
  it("renders a styled trigger without relying on the browser datetime picker", () => {
    const html = renderToStaticMarkup(
      <DateTimePicker
        ariaLabel="Chọn hạn đăng ký"
        value="2026-09-18T22:00"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("Thứ Sáu, 18/09/2026 · 22:00");
    expect(html).not.toContain('type="datetime-local"');
  });

  it("also renders a date-only control for creating synchronized weeks", () => {
    const html = renderToStaticMarkup(
      <DateTimePicker
        dateOnly
        ariaLabel="Tuần bắt đầu từ Thứ Hai"
        value="2026-09-14"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain("Thứ Hai, 14/09/2026");
    expect(html).not.toContain("· 22:00");
    expect(html).not.toContain('type="date"');
  });
});
