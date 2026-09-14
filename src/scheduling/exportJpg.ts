export async function exportScheduleJpg(
  elementId: string,
  weekStart: string,
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Không tìm thấy bảng lịch để xuất.");
  const bounds = element.getBoundingClientRect();
  const scale = Math.min(
    3,
    12_000 / bounds.width,
    12_000 / bounds.height,
    Math.sqrt(64_000_000 / (bounds.width * bounds.height)),
  );
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error("Kích thước lịch không hợp lệ.");
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale,
    useCORS: true,
    logging: false,
  });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.94),
  );
  if (!blob) throw new Error("Không tạo được ảnh lịch.");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `schedule-${weekStart}.jpg`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
