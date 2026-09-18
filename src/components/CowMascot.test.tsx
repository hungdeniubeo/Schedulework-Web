import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CowMascot } from "./CowMascot";

describe("CowMascot", () => {
  it("renders the cute interactive Gyu-Kaku mascot structure", () => {
    const html = renderToStaticMarkup(<CowMascot />);

    expect(html).toContain('class="cow-mascot-stage"');
    expect(html).toContain("cow-pupil");
    expect(html).toContain("cow-arm-wave");
    expect(html).toContain("cow-mascot-heart");
    expect(html).toContain("GYU-KAKU");
    expect(html).toContain("Linh vật bò Gyu-Kaku chibi đang vẫy tay");
  });
});
