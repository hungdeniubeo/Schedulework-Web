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
      scrollWidth: 400,
      scrollHeight: 300,
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

    expect(anchor.download).toBe("lich-lam-viec-2026-09-14.jpg");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(html2canvas).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        width: 400,
        height: 300,
        windowWidth: 1280,
        windowHeight: 720,
        scrollX: 0,
        scrollY: 0,
      }),
    );
  });

  it("exports the visible table and totals when the legacy hidden export id is requested", async () => {
    const anchor = { href: "", download: "", click: vi.fn() };
    const liveSurface = {
      scrollWidth: 1340,
      scrollHeight: 620,
      getBoundingClientRect: () => ({ width: 900, height: 620 }),
    } as HTMLElement;
    const liveSheet = {
      closest: (selector: string) =>
        selector === ".schedule-table-scroll" ? liveSurface : null,
    } as HTMLElement;
    const legacyExport = {
      scrollWidth: 700,
      scrollHeight: 400,
      getBoundingClientRect: () => ({ width: 700, height: 400 }),
    } as HTMLElement;
    const canvas = {
      toBlob: (callback: BlobCallback) => callback(new Blob(["jpg"])),
    } as HTMLCanvasElement;
    html2canvas.mockResolvedValue(canvas);
    vi.stubGlobal("document", {
      getElementById: (id: string) =>
        id === "cloud-schedule-sheet"
          ? liveSheet
          : id === "cloud-schedule-export"
            ? legacyExport
            : null,
      createElement: () => anchor,
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:schedule",
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("window", { setTimeout: (callback: () => void) => callback() });

    await exportScheduleJpg("cloud-schedule-export", "2026-09-21");

    expect(html2canvas).toHaveBeenCalledWith(
      liveSurface,
      expect.objectContaining({ width: 1340, height: 620 }),
    );
  });
});
