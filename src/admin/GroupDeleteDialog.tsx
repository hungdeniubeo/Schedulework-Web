import { ModalBackdrop } from "../components/ModalBackdrop";
import type { Group } from "../scheduling/types";

type Props = {
  group: Group;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function GroupDeleteDialog({
  group,
  deleting,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = `delete-group-${group.id}`;

  return (
    <ModalBackdrop onClose={() => !deleting && onCancel()}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Xóa nhóm {group.name}?</h2>
        <p>
          Nhân viên trong nhóm sẽ chuyển sang “Chưa có nhóm”. Lịch làm việc và dữ
          liệu đăng ký không bị xóa.
        </p>
        <footer>
          <button
            className="button secondary"
            type="button"
            autoFocus
            disabled={deleting}
            onClick={onCancel}
          >
            Hủy
          </button>
          <button
            className="button ghost danger"
            type="button"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Đang xóa..." : "Xóa nhóm"}
          </button>
        </footer>
      </section>
    </ModalBackdrop>
  );
}
