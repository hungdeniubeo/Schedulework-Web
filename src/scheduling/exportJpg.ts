export async function exportScheduleJpg(
  elementId: string,
  weekStart: string,
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Không tìm thấy bảng lịch để xuất.");
  const bounds = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(bounds.width, element.scrollWidth || 0));
  const height = Math.ceil(Math.max(bounds.height, element.scrollHeight || 0));
  const scale = Math.min(
    3,
    12_000 / width,
    12_000 / height,
    Math.sqrt(64_000_000 / (width * height)),
  );
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error("Kích thước lịch không hợp lệ.");
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale,
    useCORS: true,
    logging: false,
    width,
    height,
    windowWidth: Math.max(1280, width),
    windowHeight: Math.max(720, height),
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDocument) => {
      const clonedElement = clonedDocument.getElementById(elementId);
      if (!clonedElement) return;
      const stage = clonedElement.closest<HTMLElement>(".schedule-export-stage");
      if (stage) {
        stage.style.position = "absolute";
        stage.style.left = "0";
        stage.style.top = "0";
        stage.style.width = `${width}px`;
        stage.style.transform = "none";
      }
      clonedElement.style.width = `${width}px`;
      clonedElement.style.maxWidth = "none";
    },
  });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.94),
  );
  if (!blob) throw new Error("Không tạo được ảnh lịch.");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lich-lam-viec-${weekStart}.jpg`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
