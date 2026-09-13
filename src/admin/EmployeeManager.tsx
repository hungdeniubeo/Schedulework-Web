import { useEffect, useState, type FormEvent } from "react";
import type { TemporaryCredentials } from "../lib/serverApi";
import {
  listGroups,
  listSchedulerEmployees,
  patchEmployee,
} from "../scheduling/api";
import type { CloudEmployee, Group } from "../scheduling/types";

type Props = {
  onAdd: (name: string, email: string) => Promise<TemporaryCredentials>;
  onResetPassword: (employeeId: string) => Promise<TemporaryCredentials>;
  onChanged: () => Promise<void>;
};

function CredentialsCard({
  credentials,
  onClose,
}: {
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
        <button className="icon-button" type="button" onClick={onClose}>
          ×
        </button>
      </div>
      <label>
        Email<code>{credentials.email}</code>
      </label>
      <label>
        Mật khẩu tạm<code>{credentials.temporaryPassword}</code>
      </label>
      <button
        className="button secondary"
        type="button"
        onClick={() => void copy()}
      >
        {copied ? "Đã copy" : "Copy thông tin"}
      </button>
      <p>
        Hãy gửi thông tin này cho nhân viên ngay. Mật khẩu tạm chỉ hiển thị lần
        này và không được lưu trong database.
      </p>
    </div>
  );
}

export function EmployeeManager({ onAdd, onResetPassword, onChanged }: Props) {
  const [employees, setEmployees] = useState<CloudEmployee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<TemporaryCredentials | null>(
    null,
  );

  const load = async () => {
    const [nextEmployees, nextGroups] = await Promise.all([
      listSchedulerEmployees(),
      listGroups(),
    ]);
    setEmployees(nextEmployees);
    setGroups(nextGroups);
  };

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || adding) return;
    setAdding(true);
    setError(null);
    setCredentials(null);
    try {
      const created = await onAdd(name.trim(), email.trim());
      setName("");
      setEmail("");
      setCredentials(created);
      await load();
    } catch (reason) {
      console.error(reason);
      setError(
        reason instanceof Error ? reason.message : "Không thêm được nhân viên.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function update(
    employee: CloudEmployee,
    changes: Partial<Omit<CloudEmployee, "id">>,
  ) {
    setBusyId(employee.id);
    setError(null);
    try {
      await patchEmployee(employee.id, changes);
      await Promise.all([load(), onChanged()]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không cập nhật được nhân viên.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function move(employee: CloudEmployee, delta: number) {
    const peers = employees
      .filter((item) => item.groupId === employee.groupId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = peers.findIndex((item) => item.id === employee.id);
    const target = peers[index + delta];
    if (!target) return;
    setBusyId(employee.id);
    try {
      await Promise.all([
        patchEmployee(employee.id, { sortOrder: target.sortOrder }),
        patchEmployee(target.id, { sortOrder: employee.sortOrder }),
      ]);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không sắp xếp được nhân viên.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(employeeId: string) {
    setBusyId(employeeId);
    setError(null);
    setCredentials(null);
    try {
      setCredentials(await onResetPassword(employeeId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không đặt lại được mật khẩu.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const flags: Array<[keyof CloudEmployee, string]> = [
    ["isHeadChef", "Bếp trưởng"],
    ["isExecutiveChef", "Tổng bếp trưởng"],
    ["isManager", "Quản lý"],
    ["isFullTime", "Full-time"],
    ["isNew", "Nhân viên mới"],
  ];

  return (
    <section className="panel employee-manager">
      <div className="panel-heading">
        <div>
          <h2>Nhân viên</h2>
          <p>Tạo tài khoản, phân nhóm và quản lý thiết lập xếp lịch.</p>
        </div>
      </div>
      <form
        className="employee-create-form"
        onSubmit={(event) => void add(event)}
      >
        <input
          aria-label="Tên nhân viên"
          maxLength={120}
          required
          placeholder="Tên nhân viên"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          aria-label="Email nhân viên"
          type="email"
          required
          placeholder="Email nhân viên"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className="button primary" disabled={adding}>
          {adding ? "Đang thêm..." : "Tạo tài khoản"}
        </button>
      </form>
      {error && <div className="inline-error">{error}</div>}
      {credentials && (
        <CredentialsCard
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}
      <div className="employee-list">
        {employees.map((employee) => (
          <div className="employee-row" key={employee.id}>
            <div>
              <input
                className="employee-name-input"
                defaultValue={employee.name}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next && next !== employee.name)
                    void update(employee, { name: next });
                }}
              />
              <span
                className={`status-dot-label ${employee.active ? "active" : "inactive"}`}
              >
                {employee.active ? "Đang hoạt động" : "Đã tắt"}
              </span>
            </div>
            <div className="employee-settings">
              <label>
                Nhóm
                <select
                  value={employee.groupId ?? ""}
                  onChange={(event) =>
                    void update(employee, {
                      groupId: event.target.value || null,
                      sortOrder: 0,
                    })
                  }
                >
                  <option value="">Chưa có nhóm</option>
                  {groups.map((group) => (
                    <option value={group.id} key={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vai trò hiển thị
                <input
                  value={employee.roleLabel ?? ""}
                  onChange={(event) =>
                    setEmployees((current) =>
                      current.map((item) =>
                        item.id === employee.id
                          ? { ...item, roleLabel: event.target.value }
                          : item,
                      ),
                    )
                  }
                  onBlur={(event) =>
                    void update(employee, {
                      roleLabel: event.target.value.trim() || null,
                    })
                  }
                />
              </label>
              <div className="employee-flags">
                {flags.map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={Boolean(employee[key])}
                      onChange={(event) =>
                        void update(employee, { [key]: event.target.checked })
                      }
                    />{" "}
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="row-actions">
              <button
                className="button ghost"
                disabled={busyId === employee.id}
                onClick={() => void move(employee, -1)}
              >
                ↑
              </button>
              <button
                className="button ghost"
                disabled={busyId === employee.id}
                onClick={() => void move(employee, 1)}
              >
                ↓
              </button>
              <button
                className="button ghost"
                disabled={busyId === employee.id}
                onClick={() => void resetPassword(employee.id)}
              >
                Reset mật khẩu
              </button>
              <button
                className="button ghost"
                disabled={busyId === employee.id}
                onClick={() =>
                  void update(employee, { active: !employee.active })
                }
              >
                {employee.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
