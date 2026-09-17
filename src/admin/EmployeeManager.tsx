import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { CustomSelect } from "../components/CustomSelect";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CloseIcon,
  PlusIcon,
} from "../components/Icons";
import { ModalBackdrop } from "../components/ModalBackdrop";
import { subscribePageRefresh } from "../lib/pageRefresh";
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
import {
  employeesWithRenamedPosition,
  employeesWithUpdatedPosition,
} from "./employeePositions";

type Props = {
  onAdd: (name: string, username: string) => Promise<TemporaryCredentials>;
  onResetPassword: (employeeId: string) => Promise<TemporaryCredentials>;
  onDelete: (employeeId: string) => Promise<void>;
};

function CredentialsCard({ credentials, onClose }: {
  credentials: TemporaryCredentials;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Tên đăng nhập: ${credentials.username}\nMật khẩu tạm: ${credentials.temporaryPassword}`;

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
        <button className="icon-button" type="button" aria-label="Đóng" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <label>Tên đăng nhập<code>{credentials.username}</code></label>
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
        <span className="position-manager-summary-copy">
          <strong>Quản lý vị trí</strong>
          <small>{positions.length} vị trí</small>
        </span>
        <ChevronDownIcon className="position-manager-chevron" />
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
        <button className="button secondary" disabled={disabled || busy}>
          <PlusIcon /> Thêm vị trí
        </button>
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
                  className="button ghost icon-only"
                  type="button"
                  aria-label={`Đưa ${position.name} lên`}
                  disabled={disabled || busy || index === 0}
                  onClick={() => void run(() => onMove(index, -1))}
                ><ArrowUpIcon /></button>
                <button
                  className="button ghost icon-only"
                  type="button"
                  aria-label={`Đưa ${position.name} xuống`}
                  disabled={disabled || busy || index === positions.length - 1}
                  onClick={() => void run(() => onMove(index, 1))}
                ><ArrowDownIcon /></button>
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

type EmployeeCardProps = {
  employee: CloudEmployee;
  groupName: string;
  groups: Group[];
  positions: Position[];
  disabled: boolean;
  onUpdate: (
    employee: CloudEmployee,
    changes: Partial<Omit<CloudEmployee, "id" | "positionName">>,
  ) => void;
  onMove: (employee: CloudEmployee, delta: number) => void;
  onResetPassword: (employeeId: string) => void;
  onDeleteRequest: (employee: CloudEmployee) => void;
};

export function EmployeeCard({
  employee,
  groupName,
  groups,
  positions,
  disabled,
  onUpdate,
  onMove,
  onResetPassword,
  onDeleteRequest,
}: EmployeeCardProps) {
  const initials = employee.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("vi-VN");

  return (
    <details className="employee-row">
      <summary className="employee-summary">
        <span className="employee-avatar" aria-hidden="true">{initials}</span>
        <div className="employee-identity">
          <span className="employee-name-line">
            <strong>{employee.name}</strong>
            {employee.positionName && (
              <span className="position-badge">{employee.positionName}</span>
            )}
          </span>
          <span className="employee-group-label">{groupName}</span>
        </div>
        <span className="employee-summary-meta">
          <span className={`status-dot-label ${employee.active ? "active" : "inactive"}`}>
            {employee.active ? "Đang hoạt động" : "Đã tắt"}
          </span>
          <span className="employee-expand-icon" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </span>
      </summary>
      <div className="employee-settings">
        <label>
          Tên nhân viên
          <input
            defaultValue={employee.name}
            maxLength={120}
            disabled={disabled}
            onBlur={(event) => {
              const next = event.currentTarget.value.trim();
              if (!next) event.currentTarget.value = employee.name;
              else if (next !== employee.name) onUpdate(employee, { name: next });
            }}
          />
        </label>
        <div className="field">
          <span>Nhóm</span>
          <CustomSelect
            ariaLabel={`Nhóm của ${employee.name}`}
            value={employee.groupId ?? ""}
            disabled={disabled}
            options={[
              { value: "", label: "Chưa có nhóm" },
              ...groups.map((group) => ({ value: group.id, label: group.name })),
            ]}
            onChange={(value) => onUpdate(employee, {
              groupId: value || null,
              sortOrder: 0,
            })}
          />
        </div>
        <div className="field">
          <span>Vị trí</span>
          <CustomSelect
            ariaLabel={`Vị trí của ${employee.name}`}
            value={employee.positionId ?? ""}
            disabled={disabled}
            options={[
              { value: "", label: "Không có vị trí" },
              ...positions.map((position) => ({
                value: position.id,
                label: position.name,
              })),
            ]}
            onChange={(value) => onUpdate(employee, { positionId: value || null })}
          />
        </div>
        <div className="employee-flags">
          <label>
            <input
              type="checkbox"
              checked={employee.isNew}
              disabled={disabled}
              onChange={(event) => onUpdate(employee, { isNew: event.target.checked })}
            />
            Nhân viên mới
          </label>
        </div>
        <div className="employee-actions">
          <div className="employee-order-actions">
            <span>Thứ tự trong nhóm</span>
            <button className="button ghost icon-only" type="button" aria-label={`Đưa ${employee.name} lên trong nhóm`} disabled={disabled} onClick={() => onMove(employee, -1)}><ArrowUpIcon /></button>
            <button className="button ghost icon-only" type="button" aria-label={`Đưa ${employee.name} xuống trong nhóm`} disabled={disabled} onClick={() => onMove(employee, 1)}><ArrowDownIcon /></button>
          </div>
          <button className="button ghost" type="button" disabled={disabled} onClick={() => onResetPassword(employee.id)}>
            Reset mật khẩu
          </button>
          <button className="button ghost danger" type="button" disabled={disabled} onClick={() => onDeleteRequest(employee)}>
            Xóa
          </button>
        </div>
      </div>
    </details>
  );
}

export function DeleteEmployeeDialog({
  employee,
  deleting,
  onCancel,
  onConfirm,
}: {
  employee: CloudEmployee;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = `delete-employee-${employee.id}`;
  return (
    <ModalBackdrop onClose={() => !deleting && onCancel()}>
      <section
        className="confirm-dialog employee-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Xóa vĩnh viễn nhân viên {employee.name}?</h2>
        <p>
          Thao tác này không thể hoàn tác. Tài khoản đăng nhập, hồ sơ nhân viên,
          dữ liệu đăng ký và lịch xếp liên quan sẽ bị xóa vĩnh viễn khỏi database.
        </p>
        <div className="confirm-dialog-actions">
          <button className="button secondary" type="button" autoFocus disabled={deleting} onClick={onCancel}>
            Hủy
          </button>
          <button className="button danger" type="button" disabled={deleting} onClick={onConfirm}>
            {deleting ? "Đang xóa..." : "Xóa vĩnh viễn"}
          </button>
        </div>
      </section>
    </ModalBackdrop>
  );
}

export function EmployeeManager({ onAdd, onResetPassword, onDelete }: Props) {
  const [employees, setEmployees] = useState<CloudEmployee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [positionBusy, setPositionBusy] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<TemporaryCredentials | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CloudEmployee | null>(null);

  const refreshStructure = useCallback(async () => {
    const [nextEmployees, nextGroups] = await Promise.all([
      listSchedulerEmployees(),
      listGroups(),
    ]);
    setEmployees(nextEmployees);
    setGroups(nextGroups);
  }, []);

  useEffect(() => {
    Promise.all([refreshStructure(), listPositions().then(setPositions)])
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Không tải được nhân viên.",
        ),
      )
      .finally(() => setInitialLoading(false));
  }, [refreshStructure]);

  useEffect(() => {
    return subscribePageRefresh(() => {
      if (adding || busyId !== null || positionBusy) return;
      void refreshStructure().catch((reason) => {
        console.error(reason);
        setError(
          reason instanceof Error
            ? reason.message
            : "Không làm mới được nhóm và nhân viên.",
        );
      });
    });
  }, [adding, busyId, positionBusy, refreshStructure]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (
      !name.trim()
      || !/^[A-Za-z0-9]{3,32}$/.test(username)
      || adding
      || initialLoading
      || busyId !== null
      || positionBusy
    ) return;
    setAdding(true);
    setError(null);
    setCredentials(null);
    try {
      const created = await onAdd(name.trim(), username);
      setName("");
      setUsername("");
      setCredentials(created);
      setEmployees(await listSchedulerEmployees());
    } catch (reason) {
      console.error(reason);
      setError(reason instanceof Error ? reason.message : "Không tạo được tài khoản nhân viên.");
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
      setEmployees((current) => {
        let updated = current.map((item) =>
          item.id === employee.id ? { ...item, ...changes } : item,
        );
        if (changes.positionId !== undefined) {
          updated = employeesWithUpdatedPosition(
            updated,
            employee.id,
            changes.positionId,
            positions,
          );
        }
        return updated.sort(
          (first, second) => first.sortOrder - second.sortOrder,
        );
      });
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

  async function deleteEmployee(employee: CloudEmployee) {
    if (busyId !== null || positionBusy) return;
    setBusyId(employee.id);
    setError(null);
    try {
      await onDelete(employee.id);
      setEmployees((current) => current.filter((item) => item.id !== employee.id));
      setDeleteTarget(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không xóa được nhân viên.");
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
  const activeEmployeeCount = employees.filter((employee) => employee.active).length;

  return (
    <section className="employee-manager employee-manager-page">
      <div className="panel employee-manager-hero">
        <div>
          <span className="eyebrow">Đội ngũ</span>
          <h2>Nhân viên</h2>
          <p>Quản lý đội ngũ, nhóm làm việc và thứ tự hiển thị khi xếp lịch.</p>
        </div>
        <div className="employee-manager-stats" aria-label="Thống kê nhân viên">
          <span><strong>{activeEmployeeCount}</strong> đang hoạt động</span>
          <span><strong>{groups.length}</strong> nhóm</span>
          <span><strong>{positions.length}</strong> vị trí</span>
        </div>
      </div>
      <div className="employee-manager-tools">
        <section className="panel employee-create-card">
          <div className="employee-tool-heading">
            <div className="employee-tool-icon"><PlusIcon /></div>
            <div>
              <h3>Tạo tài khoản nhân viên</h3>
              <p>Tài khoản tạm sẽ được tạo và chỉ hiển thị một lần.</p>
            </div>
          </div>
          <form className="employee-create-form" onSubmit={(event) => void add(event)}>
            <label className="field">
              <span>Họ và tên</span>
              <input
                aria-label="Tên nhân viên"
                maxLength={120}
                required
                placeholder="Ví dụ: Nguyễn Văn An"
                value={name}
                disabled={adding || initialLoading || busyId !== null || positionBusy}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Tên đăng nhập</span>
              <input
                aria-label="Tên đăng nhập nhân viên"
                type="text"
                autoComplete="off"
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9]+"
                required
                placeholder="Ví dụ: Hung01"
                value={username}
                disabled={adding || initialLoading || busyId !== null || positionBusy}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={adding || initialLoading || busyId !== null || positionBusy}
            >
              <PlusIcon /> {adding ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </form>
        </section>
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
      </div>
      {error && <div className="inline-error">{error}</div>}
      {credentials && (
        <CredentialsCard credentials={credentials} onClose={() => setCredentials(null)} />
      )}
      <div className="employee-list-heading">
        <div>
          <h3>Danh sách nhân viên</h3>
          <p>Chọn một nhân viên để xem và cập nhật thông tin.</p>
        </div>
        <span>{employees.length} nhân viên</span>
      </div>
      <div className="employee-list">
        {employees.map((employee) => {
          const groupName = groups.find((group) => group.id === employee.groupId)?.name
            ?? "Chưa có nhóm";
          return (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              groupName={groupName}
              groups={groups}
              positions={positions}
              disabled={busyId !== null || positionBusy}
              onUpdate={(item, changes) => void update(item, changes)}
              onMove={(item, delta) => void move(item, delta)}
              onResetPassword={(employeeId) => void resetPassword(employeeId)}
              onDeleteRequest={setDeleteTarget}
            />
          );
        })}
        {initialLoading && (
          <div className="list-state loading">Đang tải danh sách nhân viên…</div>
        )}
        {employees.length === 0 && (
          <div className="list-state" hidden={initialLoading}>
            Chưa có nhân viên. Tạo tài khoản nhân viên để bắt đầu.
          </div>
        )}
      </div>
      {deleteTarget && (
        <DeleteEmployeeDialog
          employee={deleteTarget}
          deleting={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteEmployee(deleteTarget)}
        />
      )}
    </section>
  );
}