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
});
