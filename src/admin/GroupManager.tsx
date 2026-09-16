import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "../components/Icons";
import { subscribePageRefresh } from "../lib/pageRefresh";
import {
  addGroup,
  listGroups,
  patchGroup,
  removeGroup,
} from "../scheduling/api";
import type { Group } from "../scheduling/types";
import { GroupDeleteDialog } from "./GroupDeleteDialog";

export function GroupManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const load = async () => setGroups(await listGroups());

  useEffect(() => {
    load()
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Không tải được nhóm.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return subscribePageRefresh(() => {
      if (busy) return;
      void load().catch((reason) => {
        console.error(reason);
        setError(
          reason instanceof Error ? reason.message : "Không làm mới được nhóm.",
        );
      });
    });
  }, [busy]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addGroup(name.trim(), groups.length);
      setName("");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tạo được nhóm.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= groups.length || busy) return;
    const reordered = [...groups];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        reordered.map((group, order) =>
          patchGroup(group.id, { sortOrder: order }),
        ),
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không sắp xếp được nhóm.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeGroup(deleteTarget.id);
      await load();
      setDeleteTarget(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không xóa được nhóm.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group-manager-page">
      <section className="panel management-hero group-manager-hero">
        <div>
          <span className="eyebrow">Cấu trúc đội ngũ</span>
          <h2>Nhóm làm việc</h2>
          <p>Tổ chức nhân viên theo khu vực để bảng xếp lịch rõ ràng, đúng thứ tự.</p>
        </div>
        <div className="management-hero-stat">
          <strong>{groups.length}</strong>
          <span>nhóm đang sử dụng</span>
        </div>
      </section>

      <div className="group-manager-grid">
        <section className="panel management-create-card">
          <div className="employee-tool-heading">
            <div className="employee-tool-icon"><PlusIcon /></div>
            <div>
              <h3>Thêm nhóm mới</h3>
              <p>Ví dụ: Bếp, Phục vụ, Quầy bar.</p>
            </div>
          </div>
          <form className="group-create-form" onSubmit={(event) => void create(event)}>
            <label className="field">
              <span>Tên nhóm</span>
              <input
                aria-label="Tên nhóm mới"
                value={name}
                maxLength={80}
                required
                placeholder="Nhập tên nhóm"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button className="button primary" disabled={busy}>
              <PlusIcon /> Thêm nhóm
            </button>
          </form>
        </section>

        <section className="panel manage-page group-list-card">
          <div className="panel-heading management-list-heading">
            <div>
              <h3>Danh sách nhóm</h3>
              <p>Đổi tên trực tiếp hoặc sắp xếp thứ tự hiển thị.</p>
            </div>
            <span>{groups.length} nhóm</span>
          </div>
          {error && <div className="inline-error">{error}</div>}
          <div className="manage-list">
            {groups.map((group, index) => (
              <div className="manage-row" key={group.id}>
                <span className="manage-row-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <input
                  aria-label={`Tên nhóm ${group.name}`}
                  defaultValue={group.name}
                  disabled={busy}
                  onBlur={(event) => {
                    const input = event.currentTarget;
                    const next = input.value.trim();
                    if (!next) {
                      input.value = group.name;
                      return;
                    }
                    if (next === group.name) return;
                    void (async () => {
                      setError(null);
                      try {
                        await patchGroup(group.id, { name: next });
                        await load();
                      } catch (reason) {
                        input.value = group.name;
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : "Không cập nhật được nhóm.",
                        );
                      }
                    })();
                  }}
                />
                <div className="row-actions">
                  <button
                    className="button ghost icon-only"
                    type="button"
                    aria-label={`Đưa ${group.name} lên`}
                    disabled={busy || index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowUpIcon />
                  </button>
                  <button
                    className="button ghost icon-only"
                    type="button"
                    aria-label={`Đưa ${group.name} xuống`}
                    disabled={busy || index === groups.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDownIcon />
                  </button>
                  <button
                    className="button ghost danger"
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleteTarget(group)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
            {loading && (
              <div className="list-state loading">Đang tải danh sách nhóm…</div>
            )}
            {groups.length === 0 && (
              <div className="list-state" hidden={loading}>
                Chưa có nhóm. Thêm nhóm để sắp xếp nhân viên.
              </div>
            )}
          </div>
        </section>
      </div>

      {deleteTarget && (
        <GroupDeleteDialog
          group={deleteTarget}
          deleting={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
