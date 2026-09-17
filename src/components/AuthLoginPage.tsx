import { useState, type FormEvent } from "react";
import { signInWithUsername } from "../lib/serverApi";
import { BrandLogo } from "./BrandLogo";

type Props = {
  title: string;
  description: string;
};

export function AuthLoginPage({ title, description }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithUsername(username, password);
    } catch (reason) {
      console.error(reason);
      setError("Tên đăng nhập hoặc mật khẩu không đúng.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={(event) => void login(event)}>
        <div className="brand-lockup">
          <BrandLogo />
          <strong>ScheduleWork</strong>
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        <label>
          Tên đăng nhập
          <input
            type="text"
            autoComplete="username"
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9]+"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            autoComplete="current-password"
            required
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
          disabled={loading}
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
        <small>Không có đăng ký tài khoản công khai.</small>
      </form>
    </main>
  );
}
