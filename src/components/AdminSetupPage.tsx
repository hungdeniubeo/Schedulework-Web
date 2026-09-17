import { useEffect, useState, type FormEvent } from "react";
import {
  bootstrapAdmin,
  getAdminBootstrapAvailability,
} from "../lib/serverApi";
import { BrandLogo } from "./BrandLogo";

type Props = {
  navigate: (path: string) => void;
};

export function AdminSetupPage({ navigate }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAdminBootstrapAvailability()
      .then((nextAvailable) => {
        if (active) setAvailable(nextAvailable);
      })
      .catch((reason) => {
        console.error(reason);
        if (active) setError(
          reason instanceof Error
            ? reason.message
            : "Không kiểm tra được trạng thái thiết lập.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || available !== true) return;
    setSubmitting(true);
    setError(null);
    try {
      await bootstrapAdmin(username, password);
      navigate("/admin/login");
    } catch (reason) {
      console.error(reason);
      const message = reason instanceof Error
        ? reason.message
        : "Không thể tạo tài khoản Admin.";
      if (message === "Hệ thống đã được thiết lập.") setAvailable(false);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (available === null) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-lockup">
            <BrandLogo />
            <strong>ScheduleWork</strong>
          </div>
          <h1>Thiết lập Admin</h1>
          <p>{error ?? "Đang kiểm tra thiết lập..."}</p>
        </section>
      </main>
    );
  }

  if (available === false) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-lockup">
            <BrandLogo />
            <strong>ScheduleWork</strong>
          </div>
          <h1>Thiết lập Admin</h1>
          <p>Hệ thống đã được thiết lập.</p>
          <button
            className="button primary large"
            type="button"
            onClick={() => navigate("/admin/login")}
          >
            Đến trang đăng nhập
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <div className="brand-lockup">
          <BrandLogo />
          <strong>ScheduleWork</strong>
        </div>
        <h1>Thiết lập Admin</h1>
        <p>Tạo tài khoản quản trị đầu tiên cho hệ thống.</p>
        <label>
          Tên đăng nhập
          <input
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9]{3,32}"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <button
          className="button primary large"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Đang tạo..." : "Tạo tài khoản Admin"}
        </button>
      </form>
    </main>
  );
}
