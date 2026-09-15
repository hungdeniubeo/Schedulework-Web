import { useState, type FormEvent } from "react";
import { getSupabase } from "../lib/config";
import { BrandLogo } from "./BrandLogo";

type Props = {
  title: string;
  description: string;
};

export function AuthLoginPage({ title, description }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const { error: authError } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      console.error(authError);
      setError("Email hoặc mật khẩu không đúng.");
    }
    setLoading(false);
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
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
