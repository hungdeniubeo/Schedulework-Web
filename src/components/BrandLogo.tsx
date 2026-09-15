const GYU_KAKU_LOGO_URL =
  "https://gyu-kaku.com.vn/wp-content/uploads/2026/01/gyukaku-logo.webp";

export function BrandLogo() {
  return (
    <img
      className="hfe-site-logo-img elementor-animation- brand-logo-image"
      src={GYU_KAKU_LOGO_URL}
      alt="Gyu-Kaku"
      decoding="async"
    />
  );
}
