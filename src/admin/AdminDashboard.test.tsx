import { renderToStaticMarkup } from "react-dom/server";
import type { Session } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "./AdminDashboard";

describe("AdminDashboard", () => {
  it("renders the Gyu-Kaku love banner after the admin content", () => {
    const markup = renderToStaticMarkup(
      <AdminDashboard
        session={{} as Session}
        section="dashboard"
        search=""
        navigate={vi.fn()}
        onLogout={vi.fn(async () => undefined)}
      />,
    );

    const mainEnd = markup.indexOf("</main>");
    const bannerStart = markup.indexOf('class="love-gyukaku-banner"');

    expect(bannerStart).toBeGreaterThan(mainEnd);
    expect(markup).toContain('aria-label="I love Gyu-kaku ❤️❤️❤️"');
    expect(markup.replace(/<[^>]*>/g, "")).toContain(
      "I love Gyu-kaku ❤️❤️❤️",
    );
  });
});
