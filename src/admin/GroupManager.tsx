import { useEffect, useState, type FormEvent } from "react";
import {
  addGroup,
  listGroups,
  patchGroup,
  removeGroup,
} from "../scheduling/api";
import type { Group } from "../scheduling/types";

export function GroupManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => setGroups(await listGroups());
  useEffect(() => {
    load().catch((reason) =>
      setError(
        reason instanceof Error ? reason.message : "Không tải được nhóm.",
      ),
    ).finally(() => setLoading(false));
  }, []);

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

  return (
    <section className="panel manage-page">
      <div className="panel-heading">
        <div>
          <h2>Nhóm</h2>
          <p>Tạo, đổi tên và sắp xếp nhóm nhân viên.</p>
        </div>
      </div>
      <form className="inline-form" onSubmit={(event) => void create(event)}>
        <input
          aria-label="Tên nhóm mới"
          value={name}
          maxLength={80}
          required
          placeholder="Tên nhóm"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="button primary" disabled={busy}>
          Thêm nhóm
        </button>
      </form>
      {error && <div className="inline-error">{error}</div>}
      <div className="manage-list">
        {groups.map((group, index) => (
          <div className="manage-row" key={group.id}>
            <input
              aria-label={`Tên nhóm ${group.name}`}
              defaultValue={group.name}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== group.name)
                  void patchGroup(group.id, { name: next })
                    .then(load)
                    .catch((reason) => setError(reason.message));
              }}
            />
            <div className="row-actions">
              <button
                className="button ghost"
                type="button"
                aria-label={`Đưa ${group.name} lên`}
                disabled={busy || index === 0}
                onClick={() => void move(index, -1)}
              >
                ↑
              </button>
              <button
                className="button ghost"
                type="button"
                aria-label={`Đưa ${group.name} xuống`}
                disabled={busy || index === groups.length - 1}
                onClick={() => void move(index, 1)}
              >
                ↓
              </button>
              <button
                className="button ghost danger"
                type="button"
                disabled={busy}
                onClick={() =>
                  void removeGroup(group.id)
                    .then(load)
                    .catch((reason) => setError(reason.message))
                }
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
        {loading && <div className="list-state loading">Đang tải danh sách nhóm…</div>}
        {groups.length === 0 && (
          <div className="list-state" hidden={loading}>
            Chưa có nhóm. Thêm nhóm để sắp xếp nhân viên.
          </div>
        )}
      </div>
    </section>
  );
}
