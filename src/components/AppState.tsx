import { BrandLogo } from "./BrandLogo";

type Props = {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
};

export function AppState({ title, message, action }: Props) {
  return (
    <main className="center-state">
      <div className="state-mark">
        <BrandLogo />
      </div>
      <h1>{title}</h1>
      <p>{message}</p>
      {action && (
        <button
          className="button primary"
          type="button"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </main>
  );
}
