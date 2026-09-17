import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../styles/index.css", import.meta.url),
  "utf8",
);

describe("mobile registration layout", () => {
  it("centers the mobile option picker in the viewport", () => {
    expect(css).toMatch(
      /\.mobile-option-picker-backdrop\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s,
    );
    expect(css).toMatch(
      /\.mobile-option-picker-sheet\s*\{[^}]*width:\s*min\(calc\(100% - 32px\), 480px\);[^}]*border-radius:\s*20px;/s,
    );
  });

  it("keeps the registration submit bar fixed above the mobile safe area", () => {
    expect(css).toMatch(
      /\.sticky-submit\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;/s,
    );
    expect(css).toMatch(
      /\.employee-page\s*\{[^}]*padding-bottom:\s*calc\(112px \+ env\(safe-area-inset-bottom\)\);/s,
    );
  });
});
