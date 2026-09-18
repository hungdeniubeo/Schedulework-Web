import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CowMascot } from "./CowMascot";

describe("CowMascot", () => {
  it("uses the supplied Gyu-Kaku cow artwork", () => {
    const html = renderToStaticMarkup(<CowMascot />);

    expect(html).toContain('src="/gyukaku-cow-mascot.webp"');
    expect(html).toContain("Linh vật bò Gyu-Kaku chibi đang vẫy tay");
    expect(html).toContain('class="cow-mascot-stage"');
    expect(html).toContain('class="cow-mascot-image"');
  });
});
