import type { PointerEvent as ReactPointerEvent } from "react";
import "../styles/CowMascot.css";

const MASCOT_SRC = "/gyukaku-cow-mascot.webp";
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function CowMascot() {
  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(
      ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2,
    );
    const y = clamp(
      ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2,
    );

    event.currentTarget.style.setProperty("--cow-x", `${x * 8}px`);
    event.currentTarget.style.setProperty("--cow-y", `${y * 5}px`);
    event.currentTarget.style.setProperty("--cow-tilt", `${x * 2.2}deg`);
  }

  function resetPointer(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--cow-x", "0px");
    event.currentTarget.style.setProperty("--cow-y", "0px");
    event.currentTarget.style.setProperty("--cow-tilt", "0deg");
  }

  return (
    <div
      className="cow-mascot-stage"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <span className="cow-mascot-glow" aria-hidden="true" />
      <span className="cow-mascot-spark cow-mascot-spark-one" aria-hidden="true">
        ✦
      </span>
      <span className="cow-mascot-spark cow-mascot-spark-two" aria-hidden="true">
        ✦
      </span>
      <span className="cow-mascot-heart" aria-hidden="true">
        ♥
      </span>

      <div className="cow-mascot-parallax">
        <div className="cow-mascot-float">
          <img
            className="cow-mascot-image"
            src={MASCOT_SRC}
            alt="Linh vật bò Gyu-Kaku chibi đang vẫy tay"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
