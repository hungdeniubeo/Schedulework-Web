import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GroupDeleteDialog } from "./GroupDeleteDialog";

describe("GroupDeleteDialog", () => {
  it("explains that employees become ungrouped while schedule data stays", () => {
    const html = renderToStaticMarkup(
      <GroupDeleteDialog
        group={{ id: "group-1", name: "BAR", sortOrder: 0 }}
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain("Xóa nhóm BAR?");
    expect(html).toContain("Chưa có nhóm");
    expect(html).toContain("Lịch làm việc và dữ liệu đăng ký không bị xóa");
  });
});
