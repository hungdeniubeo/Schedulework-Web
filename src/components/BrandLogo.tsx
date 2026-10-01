const GYU_KAKU_LOGO_URL = "/gyukaku-logo.png";

type HomeTarget = {
  path: string;
  navigate: (path: string) => void;
};

type Props = {
  home?: HomeTarget;
  mobileHome?: HomeTarget;
};

export function BrandLogo({ home, mobileHome }: Props = {}) {
  function handleClick() {
    if (home) {
      home.navigate(home.path);
      return;
    }

    if (
      mobileHome &&
      typeof matchMedia === "function" &&
      matchMedia("(max-width: 680px)").matches
    ) {
      mobileHome.navigate(mobileHome.path);
      return;
    }

    history.back();
  }

  return (
    <button
      type="button"
      className="brand-logo-back"
      aria-label="Quay lại"
      title="Quay lại"
      onClick={handleClick}
    >
      <img
        className="hfe-site-logo-img elementor-animation- brand-logo-image"
        src={GYU_KAKU_LOGO_URL}
        alt="Gyu-Kaku"
        decoding="async"
      />
    </button>
  );
}
