import { afterEach, describe, expect, it, vi } from "vitest";

const html2canvas = vi.hoisted(() => vi.fn());

vi.mock("html2canvas", () => ({ default: html2canvas }));

import { exportScheduleJpg } from "./exportJpg";

describe("exportScheduleJpg", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("downloads the exported schedule with its week start date", async () => {
    const anchor = { href: "", download: "", click: vi.fn() };
    const element = {
      getBoundingClientRect: () => ({ width: 400, height: 300 }),
    } as HTMLElement;
    const canvas = {
      toBlob: (callback: BlobCallback) => callback(new Blob(["jpg"])),
    } as HTMLCanvasElement;
    html2canvas.mockResolvedValue(canvas);
    vi.stubGlobal("document", {
      getElementById: () => element,
      createElement: () => anchor,
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:schedule",
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("window", { setTimeout: (callback: () => void) => callback() });

    await exportScheduleJpg("cloud-schedule-sheet", "2026-09-14");

    expect(anchor.download).toBe("schedule-2026-09-14.jpg");
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});
