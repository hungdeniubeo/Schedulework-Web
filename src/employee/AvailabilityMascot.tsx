import "./AvailabilityMascot.css";

const mascotModules = import.meta.glob<string>(
  "../assets/availability-mascots/*.{png,jpg,jpeg,webp,avif}",
  { eager: true, import: "default" },
);

const mascotSources = Object.entries(mascotModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, source]) => source);

const MOTION_CLASSES = [
  "availability-mascot-float-a",
  "availability-mascot-float-b",
  "availability-mascot-float-c",
] as const;

export function pickRandomMascot<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T | null {
  if (items.length === 0) return null;

  const index = Math.min(
    items.length - 1,
    Math.max(0, Math.floor(random() * items.length)),
  );

  return items[index] ?? null;
}

// Randomize once per full web load. The chosen mascot stays stable while the
// employee moves between portal tabs during the same load.
const selectedMascot = pickRandomMascot(mascotSources);
const selectedMotion =
  pickRandomMascot(MOTION_CLASSES) ?? "availability-mascot-float-a";

export function AvailabilityMascot() {
  if (!selectedMascot) return null;

  return (
    <div
      className={`availability-mascot ${selectedMotion}`}
      aria-hidden="true"
    >
      <span className="availability-mascot-glow" />
      <img src={selectedMascot} alt="" draggable={false} />
    </div>
  );
}
