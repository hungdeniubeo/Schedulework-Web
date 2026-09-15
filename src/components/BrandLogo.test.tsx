import { afterEach, describe, expect, it, vi } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("goes back when the logo button is pressed", () => {
    const back = vi.fn();
    vi.stubGlobal("history", { back });

    const logoButton = BrandLogo();

    expect(logoButton.type).toBe("button");
    expect(logoButton.props.type).toBe("button");
    expect(logoButton.props["aria-label"]).toBe("Quay lại");

    logoButton.props.onClick();

    expect(back).toHaveBeenCalledOnce();
  });

  it("opens the employee home on mobile", () => {
    const back = vi.fn();
    const navigate = vi.fn();
    vi.stubGlobal("history", { back });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));

    const logoButton = BrandLogo({
      mobileHome: { path: "/app/availability", navigate },
    });

    logoButton.props.onClick();

    expect(navigate).toHaveBeenCalledWith("/app/availability");
    expect(back).not.toHaveBeenCalled();
  });

  it("always opens the configured home", () => {
    const back = vi.fn();
    const navigate = vi.fn();
    vi.stubGlobal("history", { back });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));

    const logoButton = BrandLogo({
      home: { path: "/admin", navigate },
    });

    logoButton.props.onClick();

    expect(navigate).toHaveBeenCalledWith("/admin");
    expect(back).not.toHaveBeenCalled();
  });

  it("keeps going back on desktop when a mobile home is configured", () => {
    const back = vi.fn();
    const navigate = vi.fn();
    vi.stubGlobal("history", { back });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));

    const logoButton = BrandLogo({
      mobileHome: { path: "/admin", navigate },
    });

    logoButton.props.onClick();

    expect(back).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });
});
