import { useRef, useState } from "react";
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

const REACTION_CLASSES = [
  "availability-mascot-react-pop",
  "availability-mascot-react-wiggle",
  "availability-mascot-react-twirl",
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
  const [reaction, setReaction] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const resetTimerRef = useRef<number | null>(null);

  if (!selectedMascot) return null;

  function react() {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    const nextReaction =
      pickRandomMascot(REACTION_CLASSES) ?? "availability-mascot-react-pop";

    // Clear first so rapidly repeated taps always restart the animation.
    setReaction(null);
    setBurstKey((value) => value + 1);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setReaction(nextReaction);
        resetTimerRef.current = window.setTimeout(() => {
          setReaction(null);
          resetTimerRef.current = null;
        }, 760);
      });
    });
  }

  return (
    <button
      type="button"
      className={`availability-mascot ${selectedMotion}`}
      onClick={react}
      aria-label="Chạm vào mascot"
    >
      <span className="availability-mascot-glow" aria-hidden="true" />

      <span
        className={`availability-mascot-reaction ${reaction ?? ""}`}
        aria-hidden="true"
      >
        <img src={selectedMascot} alt="" draggable={false} />
      </span>

      {burstKey > 0 && (
        <span
          key={burstKey}
          className="availability-mascot-burst"
          aria-hidden="true"
        >
          <i className="availability-mascot-burst-heart">♥</i>
          <i className="availability-mascot-burst-star-one">✦</i>
          <i className="availability-mascot-burst-star-two">✦</i>
          <i className="availability-mascot-burst-dot-one">●</i>
          <i className="availability-mascot-burst-dot-two">●</i>
        </span>
      )}
    </button>
  );
}
