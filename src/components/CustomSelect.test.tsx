import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomSelect } from "./CustomSelect";

describe("CustomSelect", () => {
  it("renders the selected Admin option with combobox semantics", () => {
    const html = renderToStaticMarkup(
      <CustomSelect
        ariaLabel="Vị trí của Nguyễn Phi Hùng"
        value="head-chef"
        options={[
          { value: "", label: "Không có vị trí" },
          { value: "head-chef", label: "Bếp trưởng" },
        ]}
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Vị trí của Nguyễn Phi Hùng"');
    expect(html).toContain("Bếp trưởng");
  });

  it("supports a rich presentation without changing its combobox behavior", () => {
    const html = renderToStaticMarkup(
      <CustomSelect
        ariaLabel="Tuần đang quản lý"
        className="week-picker"
        value="week-1"
        options={[{ value: "week-1", label: "28/09 – 04/10" }]}
        renderValue={(option) => <strong>{option.label}</strong>}
        renderOption={(option) => (
          <span>
            <strong>{option.label}</strong>
            <small>Hạn đăng ký: 25/09 · 22:00</small>
          </span>
        )}
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('class="custom-select week-picker');
    expect(html).toContain('aria-label="Tuần đang quản lý"');
    expect(html).toContain("<strong>28/09 – 04/10</strong>");
  });
});
