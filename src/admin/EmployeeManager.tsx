import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TemporaryCredentials } from "../lib/serverApi";
import {
  addPosition,
  listGroups,
  listPositions,
  listSchedulerEmployees,
  patchEmployee,
  patchPosition,
  removePosition,
  swapPositionOrder,
} from "../scheduling/api";
import type { CloudEmployee, Group, Position } from "../scheduling/types";
import { employeesWithRenamedPosition } from "./employeePositions";

type Props = {
  onAdd: (name: string, email: string) => Promise<TemporaryCredentials>;
  onResetPassword: (employeeId: string) => Promise<TemporaryCredentials>;
};

function CredentialsCard({ credentials, onClose }: {
  credentials: TemporaryCredentials;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Email: ${credentials.email}\nMật khẩu tạm: ${credentials.temporaryPassword}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (reason) {
      console.error(reason);
      setCopied(false);
    }
  }

  return (
    <div className="credentials-card" role="status">
      <div>
        <strong>Tài khoản đã sẵn sàng</strong>
        <button className="icon-button" type="button" onClick={onClose}>×</button>
      </div>
      <label>Email<code>{credentials.email}</code></label>
      <label>Mật khẩu tạm<code>{credentials.temporaryPassword}</code></label>
      <button className="button secondary" type="button" onClick={() => void copy()}>
        {copied ? "Đã copy" : "Copy thông tin"}
      </button>
      <p>
        Hãy gửi thông tin này cho nhân viên ngay. Mật khẩu tạm chỉ hiển thị lần
        này và không được lưu trong database.
      </p>
    </div>
  );
}

function PositionManager({
  positions,
  assignedPositionIds,
  onCreate,
  onRename,
  onMove,
  onDelete,
  disabled,
  onBusyChange,
}: {
  positions: Position[];
  assignedPositionIds: Set<string>;
  onCreate: (name: string) => Promise<void>;
  onRename: (position: Position, name: string) => Promise<void>;
  onMove: (index: number, delta: number) => Promise<void>;
  onDelete: (position: Position) => Promise<void>;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function run(operation: () => Promise<void>): Promise<boolean> {
    if (disabled || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      await operation();
      return true;
    } catch {
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next) return;
    if (await run(() => onCreate(next))) setName("");
  }

  return (
    <details className="position-manager">
      <summary>
        <span>Quản lý vị trí</span>
        <small>{positions.length} vị trí</small>
      </summary>
      <form className="position-create-form" onSubmit={(event) => void create(event)}>
        <input
          aria-label="Tên vị trí"
          maxLength={80}
          placeholder="Tên vị trí"
          value={name}
          disabled={disabled || busy}
          onChange={(event) => setName(event.target.value)}
        />
        <button className="button secondary" disabled={disabled || busy}>+ Thêm vị trí</button>
      </form>
      <div className="position-list">
        {positions.map((position, index) => {
          const assigned = assignedPositionIds.has(position.id);
          return (
            <div className="position-row" key={position.id}>
              <input
                aria-label={`Tên vị trí ${position.name}`}
                defaultValue={position.name}
                maxLength={80}
                disabled={disabled || busy}
                onBlur={(event) => {
                  const next = event.currentTarget.value.trim();
                  if (!next) event.currentTarget.value = position.name;
                  else if (next !== position.name) {
                    const input = event.currentTarget;
                    void run(() => onRename(position, next)).then((saved) => {
                      if (!saved) input.value = position.name;
                    });
                  }
                }}
              />
              <div className="position-actions">
                <button
                  className="button ghost"
                  type="button"
                  aria-label={`Đưa ${position.name} lên`}
                  disabled={disabled || busy || index === 0}
                  onClick={() => void run(() => onMove(index, -1))}
                >↑</button>
                <button
                  className="button ghost"
                  type="button"
                  aria-label={`Đưa ${position.name} xuống`}
                  disabled={disabled || busy || index === positions.length - 1}
                  onClick={() => void run(() => onMove(index, 1))}
                >↓</button>
                <button
                  className="button ghost danger"
                  type="button"
                  disabled={disabled || busy || assigned}
                  title={assigned ? "Hãy bỏ gán vị trí trước khi xóa." : undefined}
                  onClick={() => void run(() => onDelete(position))}
                >Xóa</button>
              </div>
            </div>
          );
        })}
        {positions.length === 0 && <small className="position-empty">Chưa có vị trí.</small>}
      </div>
    </details>
  );
}

export function EmployeeManager({ onAdd, onResetPassword }: Props) {
  const [employees, setEmployees] = useState<CloudEmployee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [positionBusy, setPositionBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<TemporaryCredentials | null>(null);

  useEffect(() => {
    Promise.all([listSchedulerEmployees(), listGroups(), listPositions()])
      .then(([nextEmployees, nextGroups, nextPositions]) => {
        setEmployees(nextEmployees);
        setGroups(nextGroups);
        setPositions(nextPositions);
      })
      .catch((reason) => setError(
        reason instanceof Error ? reason.message : "Không tải được nhân viên.",
      ))
      .finally(() => setInitialLoading(false));
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (
      !name.trim()
      || !email.trim()
      || adding
      || initialLoading
      || busyId !== null
      || positionBusy
    ) return;
    setAdding(true);
    setError(null);
    setCredentials(null);
    try {
      const created = await onAdd(name.trim(), email.trim());
      setName("");
      setEmail("");
      setCredentials(created);
      setEmployees(await listSchedulerEmployees());
    } catch (reason) {
      console.error(reason);
      setError(reason instanceof Error ? reason.message : "Không thêm được nhân viên.");
    } finally {
      setAdding(false);
    }
  }

  async function update(
    employee: CloudEmployee,
    changes: Partial<Omit<CloudEmployee, "id" | "positionName">>,
  ) {
    if (busyId !== null || positionBusy) return;
    setBusyId(employee.id);
    setError(null);
    try {
      await patchEmployee(employee.id, changes);
      setEmployees((current) => current.map((item) =>
        item.id === employee.id
          ? {
              ...item,
              ...changes,
              positionName: changes.positionId === undefined
                ? item.positionName
                : (positions.find((position) => position.id === changes.positionId)?.name ?? null),
            }
          : item,
      ).sort((first, second) => first.sortOrder - second.sortOrder));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không cập nhật được nhân viên.");
    } finally {
      setBusyId(null);
    }
  }

  async function move(employee: CloudEmployee, delta: number) {
    if (busyId !== null || positionBusy) return;
    const peers = employees
      .filter((item) => item.groupId === employee.groupId)
      .sort((first, second) => first.sortOrder - second.sortOrder);
    const index = peers.findIndex((item) => item.id === employee.id);
    const target = peers[index + delta];
    if (!target) return;
    setBusyId(employee.id);
    setError(null);
    try {
      await Promise.all([
        patchEmployee(employee.id, { sortOrder: target.sortOrder }),
        patchEmployee(target.id, { sortOrder: employee.sortOrder }),
      ]);
      setEmployees((current) => current.map((item) =>
        item.id === employee.id
          ? { ...item, sortOrder: target.sortOrder }
          : item.id === target.id
            ? { ...item, sortOrder: employee.sortOrder }
            : item,
      ).sort((first, second) => first.sortOrder - second.sortOrder));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không sắp xếp được nhân viên.");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(employeeId: string) {
    if (busyId !== null || positionBusy) return;
    setBusyId(employeeId);
    setError(null);
    setCredentials(null);
    try {
      setCredentials(await onResetPassword(employeeId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không đặt lại được mật khẩu.");
    } finally {
      setBusyId(null);
    }
  }

  async function createPosition(positionName: string) {
    setError(null);
    try {
      const nextOrder = Math.max(-1, ...positions.map((position) => position.sortOrder)) + 1;
      const created = await addPosition(positionName, nextOrder);
      setPositions((current) => [...current, created]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được vị trí.");
      throw reason;
    }
  }

  async function renamePosition(position: Position, positionName: string) {
    setError(null);
    try {
      await patchPosition(position.id, { name: positionName });
      const renamed = { ...position, name: positionName };
      setPositions((current) => current.map((item) =>
        item.id === position.id ? renamed : item,
      ));
      setEmployees((current) => employeesWithRenamedPosition(current, renamed));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không đổi tên được vị trí.");
      throw reason;
    }
  }

  async function movePosition(index: number, delta: number) {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= positions.length) return;
    const current = positions[index];
    const target = positions[targetIndex];
    setError(null);
    try {
      await swapPositionOrder(current.id, target.id);
      setPositions((items) => {
        const reordered = [...items];
        reordered[index] = { ...target, sortOrder: current.sortOrder };
        reordered[targetIndex] = { ...current, sortOrder: target.sortOrder };
        return reordered;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không sắp xếp được vị trí.");
      throw reason;
    }
  }

  async function deletePosition(position: Position) {
    setError(null);
    try {
      await removePosition(position.id);
      setPositions((current) => current.filter((item) => item.id !== position.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không xóa được vị trí.");
      throw reason;
    }
  }

  const assignedPositionIds = new Set(
    employees.flatMap((employee) => employee.positionId ? [employee.positionId] : []),
  );

  return (
    <section className="panel employee-manager">
      <div className="panel-heading">
        <div>
          <h2>Nhân viên</h2>
          <p>Tạo tài khoản, phân nhóm và quản lý thiết lập xếp lịch.</p>
        </div>
      </div>
      <form className="employee-create-form" onSubmit={(event) => void add(event)}>
        <input
          aria-label="Tên nhân viên"
          maxLength={120}
          required
          placeholder="Tên nhân viên"
          value={name}
          disabled={adding || initialLoading || busyId !== null || positionBusy}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          aria-label="Email nhân viên"
          type="email"
          required
          placeholder="Email nhân viên"
          value={email}
          disabled={adding || initialLoading || busyId !== null || positionBusy}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          className="button primary"
          disabled={adding || initialLoading || busyId !== null || positionBusy}
        >
          {adding ? "Đang thêm..." : "Tạo tài khoản"}
        </button>
      </form>
      <PositionManager
        positions={positions}
        assignedPositionIds={assignedPositionIds}
        onCreate={createPosition}
        onRename={renamePosition}
        onMove={movePosition}
        onDelete={deletePosition}
        disabled={initialLoading || adding || busyId !== null}
        onBusyChange={setPositionBusy}
      />
      {error && <div className="inline-error">{error}</div>}
      {credentials && (
        <CredentialsCard credentials={credentials} onClose={() => setCredentials(null)} />
      )}
      <div className="employee-list">
        {employees.map((employee) => {
          const groupName = groups.find((group) => group.id === employee.groupId)?.name
            ?? "Chưa có nhóm";
          return (
            <article className="employee-row" key={employee.id}>
              <div className="employee-summary">
                <div className="employee-identity">
                  <strong>{employee.name}</strong>
                  {employee.positionName && (
                    <span className="position-badge">{employee.positionName}</span>
                  )}
                </div>
                <span className={`status-dot-label ${employee.active ? "active" : "inactive"}`}>
                  {employee.active ? "Đang hoạt động" : "Đã tắt"}
                </span>
              </div>
              <details className="employee-advanced">
                <summary>
                  <span>{groupName}</span>
                  <span>Chỉnh sửa</span>
                </summary>
                <div className="employee-settings">
                  <label>
                    Tên nhân viên
                    <input
                      defaultValue={employee.name}
                      maxLength={120}
                      disabled={busyId !== null || positionBusy}
                      onBlur={(event) => {
                        const next = event.currentTarget.value.trim();
                        if (!next) event.currentTarget.value = employee.name;
                        else if (next !== employee.name) void update(employee, { name: next });
                      }}
                    />
                  </label>
                  <label>
                    Nhóm
                    <select
                      value={employee.groupId ?? ""}
                      disabled={busyId !== null || positionBusy}
                      onChange={(event) => void update(employee, {
                        groupId: event.target.value || null,
                        sortOrder: 0,
                      })}
                    >
                      <option value="">Chưa có nhóm</option>
                      {groups.map((group) => (
                        <option value={group.id} key={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vị trí
                    <select
                      value={employee.positionId ?? ""}
                      disabled={busyId !== null || positionBusy}
                      onChange={(event) => void update(employee, {
                        positionId: event.target.value || null,
                      })}
                    >
                      <option value="">Không có vị trí</option>
                      {positions.map((position) => (
                        <option value={position.id} key={position.id}>{position.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="employee-flags">
                    <label>
                      <input
                        type="checkbox"
                        checked={employee.isFullTime}
                        disabled={busyId !== null || positionBusy}
                        onChange={(event) => void update(employee, { isFullTime: event.target.checked })}
                      />
                      Full-time
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={employee.isNew}
                        disabled={busyId !== null || positionBusy}
                        onChange={(event) => void update(employee, { isNew: event.target.checked })}
                      />
                      Nhân viên mới
                    </label>
                  </div>
                  <div className="employee-actions">
                    <div className="employee-order-actions">
                      <span>Thứ tự trong nhóm</span>
                      <button className="button ghost" type="button" disabled={busyId !== null || positionBusy} onClick={() => void move(employee, -1)}>↑</button>
                      <button className="button ghost" type="button" disabled={busyId !== null || positionBusy} onClick={() => void move(employee, 1)}>↓</button>
                    </div>
                    <button className="button ghost" type="button" disabled={busyId !== null || positionBusy} onClick={() => void resetPassword(employee.id)}>
                      Reset mật khẩu
                    </button>
                    <button className="button ghost danger" type="button" disabled={busyId !== null || positionBusy} onClick={() => void update(employee, { active: !employee.active })}>
                      {employee.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
