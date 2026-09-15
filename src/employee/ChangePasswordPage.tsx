import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppState } from "../components/AppState";
import { BrandLogo } from "../components/BrandLogo";
import { getSupabase } from "../lib/config";
import { changeEmployeePassword } from "../lib/serverApi";

type Props = { navigate: (path: string) => void };

export function ChangePasswordPage({ navigate }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (password.length < 8)
      return setError("Mật khẩu phải có ít nhất 8 ký tự.");
    if (password !== confirmation) return setError("Hai mật khẩu không khớp.");

    setSaving(true);
    setError(null);
    try {
      if (!session) throw new Error("AUTH_REQUIRED");
      await changeEmployeePassword(password, session.access_token);
      navigate("/app/availability");
    } catch (reason) {
      console.error(reason);
      setError("Không đổi được mật khẩu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <AppState title="Một chút thôi…" message="Đang kiểm tra tài khoản." />
    );
  if (!session) {
    return (
      <AppState
        title="Bạn chưa đăng nhập"
        message="Hãy đăng nhập bằng mật khẩu tạm trước khi đổi mật khẩu."
        action={{ label: "Đăng nhập", onClick: () => navigate("/login") }}
      />
    );
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={(event) => void save(event)}>
        <div className="brand-lockup">
          <BrandLogo />
          <strong>ScheduleWork</strong>
        </div>
        <h1>Đổi mật khẩu</h1>
        <p>
          Mật khẩu mới chỉ bạn biết và không thể xem lại trong trang quản trị.
        </p>
        <label>
          Mật khẩu mới
          <input
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Xác nhận mật khẩu
          <input
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        {error && <div className="inline-error">{error}</div>}
        <button className="button primary large" disabled={saving}>
          {saving ? "Đang lưu..." : "Đổi mật khẩu"}
        </button>
        <button
          type="button"
          className="button secondary large"
          onClick={() => navigate("/app/availability")}
        >
          Quay lại
        </button>
      </form>
    </main>
  );
}
