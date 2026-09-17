import { describe, expect, it } from "vitest";
import css from "../styles/mobile-registration.css?raw";

describe("mobile registration layout", () => {
  it("centers the mobile option picker in the viewport", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*600px\)/);
    expect(css).toMatch(
      /\.mobile-option-picker-backdrop\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s,
    );
    expect(css).toMatch(
      /\.mobile-option-picker-sheet\s*\{[^}]*width:\s*min\(calc\(100% - 32px\), 480px\);[^}]*border-radius:\s*20px;/s,
    );
    expect(css).toMatch(
      /\.mobile-option-picker-options\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s,
    );
  });

  it("keeps the registration submit bar fixed above the mobile safe area", () => {
    expect(css).toMatch(
      /\.sticky-submit\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;[^}]*padding-bottom:\s*max\(12px, env\(safe-area-inset-bottom\)\);/s,
    );
    expect(css).toMatch(
      /\.employee-page\s*\{[^}]*padding-bottom:\s*calc\(112px \+ env\(safe-area-inset-bottom\)\);/s,
    );
  });
});
