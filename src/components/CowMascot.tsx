import type { PointerEvent as ReactPointerEvent } from "react";
import "../styles/CowMascot.css";

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

    event.currentTarget.style.setProperty("--cow-eye-x", `${x * 7}px`);
    event.currentTarget.style.setProperty("--cow-eye-y", `${y * 5}px`);
    event.currentTarget.style.setProperty("--cow-follow-x", `${x * 5}px`);
    event.currentTarget.style.setProperty("--cow-follow-y", `${y * 3}px`);
    event.currentTarget.style.setProperty("--cow-lean", `${x * 2}deg`);
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--cow-eye-x", "0px");
    event.currentTarget.style.setProperty("--cow-eye-y", "0px");
    event.currentTarget.style.setProperty("--cow-follow-x", "0px");
    event.currentTarget.style.setProperty("--cow-follow-y", "0px");
    event.currentTarget.style.setProperty("--cow-lean", "0deg");
  }

  return (
    <div
      className="cow-mascot-stage"
      role="img"
      aria-label="Linh vật bò Gyu-Kaku chibi đang vẫy tay"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
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

      <div className="cow-mascot-motion">
        <svg
          className="cow-mascot"
          viewBox="0 0 420 420"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="cute-cow-fur" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fffdf8" />
              <stop offset="1" stopColor="#f5eadb" />
            </linearGradient>
            <linearGradient id="cute-cow-apron" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ef4438" />
              <stop offset="1" stopColor="#bd201f" />
            </linearGradient>
            <linearGradient id="cute-cow-muzzle" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffd5d2" />
              <stop offset="1" stopColor="#f1aaa8" />
            </linearGradient>
          </defs>

          <ellipse
            className="cow-ground-shadow"
            cx="210"
            cy="389"
            rx="119"
            ry="17"
          />

          <g className="cow-character">
            <g className="cow-tail">
              <path
                d="M306 304c37 5 43 34 25 48"
                fill="none"
                stroke="#4b2b27"
                strokeWidth="13"
                strokeLinecap="round"
              />
              <path
                d="M330 348c20-12 34 2 25 16-9 13-29 7-30-6"
                fill="#5b3832"
                stroke="#4b2b27"
                strokeWidth="5"
              />
            </g>

            <ellipse
              className="cow-body"
              cx="210"
              cy="304"
              rx="96"
              ry="82"
              fill="url(#cute-cow-fur)"
              stroke="#4b2b27"
              strokeWidth="7"
            />

            <g className="cow-feet">
              <path
                d="M151 348c-9 21-5 40 14 42 20 2 29-12 30-30"
                fill="#f6ebdd"
                stroke="#4b2b27"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M269 348c9 21 5 40-14 42-20 2-29-12-30-30"
                fill="#f6ebdd"
                stroke="#4b2b27"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M153 376c15 8 28 7 39-1"
                fill="none"
                stroke="#5b3832"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M267 376c-15 8-28 7-39-1"
                fill="none"
                stroke="#5b3832"
                strokeWidth="12"
                strokeLinecap="round"
              />
            </g>

            <path
              className="cow-apron"
              d="M131 278c19-28 139-28 158 0l-12 91c-39 17-95 17-134 0Z"
              fill="url(#cute-cow-apron)"
              stroke="#8f1d1d"
              strokeWidth="6"
            />
            <path
              d="M152 281c33 12 83 12 116 0"
              fill="none"
              stroke="#ffbab2"
              strokeWidth="5"
              strokeLinecap="round"
              opacity=".7"
            />
            <rect
              x="168"
              y="307"
              width="84"
              height="46"
              rx="13"
              fill="#fffdf8"
              stroke="#f5c5bd"
              strokeWidth="3"
            />
            <text
              className="cow-apron-kanji"
              x="210"
              y="327"
              textAnchor="middle"
            >
              牛角
            </text>
            <text
              className="cow-apron-wordmark"
              x="210"
              y="345"
              textAnchor="middle"
            >
              GYU-KAKU
            </text>

            <g className="cow-arm cow-arm-left">
              <path
                d="M135 285c-27 8-43 28-43 50"
                fill="none"
                stroke="#4b2b27"
                strokeWidth="31"
                strokeLinecap="round"
              />
              <path
                d="M135 285c-27 8-43 28-43 50"
                fill="none"
                stroke="#f7ecdf"
                strokeWidth="21"
                strokeLinecap="round"
              />
              <circle
                cx="91"
                cy="337"
                r="17"
                fill="#5b3832"
                stroke="#4b2b27"
                strokeWidth="5"
              />
            </g>

            <g className="cow-arm cow-arm-wave">
              <path
                d="M285 286c26-18 42-38 50-64"
                fill="none"
                stroke="#4b2b27"
                strokeWidth="31"
                strokeLinecap="round"
              />
              <path
                d="M285 286c26-18 42-38 50-64"
                fill="none"
                stroke="#f7ecdf"
                strokeWidth="21"
                strokeLinecap="round"
              />
              <circle
                cx="337"
                cy="214"
                r="18"
                fill="#5b3832"
                stroke="#4b2b27"
                strokeWidth="5"
              />
              <path
                d="M351 195l15-11M356 210l19-2"
                fill="none"
                stroke="#e43a32"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </g>

            <g className="cow-head">
              <path
                className="cow-horn cow-horn-left"
                d="M127 84c-18-25-10-45 4-48 15-3 27 15 28 39"
                fill="#f4cf93"
                stroke="#4b2b27"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                className="cow-horn cow-horn-right"
                d="M293 84c18-25 10-45-4-48-15-3-27 15-28 39"
                fill="#f4cf93"
                stroke="#4b2b27"
                strokeWidth="6"
                strokeLinecap="round"
              />

              <g className="cow-ear cow-ear-left">
                <path
                  d="M130 96c-42-28-79-18-83 8-4 25 35 43 79 25Z"
                  fill="#fffaf3"
                  stroke="#4b2b27"
                  strokeWidth="7"
                />
                <path
                  d="M112 108c-24-10-42-4-46 5 10 11 27 13 45 6Z"
                  fill="#f5aba9"
                />
              </g>
              <g className="cow-ear cow-ear-right">
                <path
                  d="M290 96c42-28 79-18 83 8 4 25-35 43-79 25Z"
                  fill="#fffaf3"
                  stroke="#4b2b27"
                  strokeWidth="7"
                />
                <path
                  d="M308 108c24-10 42-4 46 5-10 11-27 13-45 6Z"
                  fill="#f5aba9"
                />
              </g>

              <ellipse
                className="cow-face"
                cx="210"
                cy="166"
                rx="145"
                ry="121"
                fill="url(#cute-cow-fur)"
                stroke="#4b2b27"
                strokeWidth="8"
              />

              <path
                d="M92 119c25-38 62-48 91-31-7 34-30 53-69 49-13-4-20-10-22-18Z"
                fill="#5b3832"
              />
              <path
                d="M276 79c36 8 59 33 65 70-34 10-62-5-77-34 0-17 4-28 12-36Z"
                fill="#5b3832"
              />

              <path
                className="cow-hair"
                d="M176 54c9-24 28-34 36-19 5-16 27-18 31-1 15-6 26 12 13 24-19 14-55 17-80-4Z"
                fill="#fffaf3"
                stroke="#4b2b27"
                strokeWidth="6"
                strokeLinejoin="round"
              />

              <g className="cow-eye cow-eye-left">
                <ellipse
                  className="cow-eye-white"
                  cx="159"
                  cy="166"
                  rx="34"
                  ry="39"
                  fill="#fff"
                  stroke="#4b2b27"
                  strokeWidth="6"
                />
                <g className="cow-pupil">
                  <ellipse cx="161" cy="171" rx="19" ry="24" fill="#3d2825" />
                  <circle cx="153" cy="159" r="7" fill="#fff" />
                  <circle cx="169" cy="177" r="3.5" fill="#fff" opacity=".85" />
                </g>
              </g>

              <g className="cow-eye cow-eye-right">
                <ellipse
                  className="cow-eye-white"
                  cx="261"
                  cy="166"
                  rx="34"
                  ry="39"
                  fill="#fff"
                  stroke="#4b2b27"
                  strokeWidth="6"
                />
                <g className="cow-pupil">
                  <ellipse cx="259" cy="171" rx="19" ry="24" fill="#3d2825" />
                  <circle cx="251" cy="159" r="7" fill="#fff" />
                  <circle cx="267" cy="177" r="3.5" fill="#fff" opacity=".85" />
                </g>
              </g>

              <ellipse
                className="cow-cheek cow-cheek-left"
                cx="114"
                cy="207"
                rx="26"
                ry="13"
                fill="#f6a9ab"
                opacity=".72"
              />
              <ellipse
                className="cow-cheek cow-cheek-right"
                cx="306"
                cy="207"
                rx="26"
                ry="13"
                fill="#f6a9ab"
                opacity=".72"
              />

              <ellipse
                className="cow-muzzle"
                cx="210"
                cy="224"
                rx="72"
                ry="48"
                fill="url(#cute-cow-muzzle)"
                stroke="#4b2b27"
                strokeWidth="6"
              />
              <ellipse cx="184" cy="217" rx="7" ry="9" fill="#72423c" />
              <ellipse cx="236" cy="217" rx="7" ry="9" fill="#72423c" />

              <path
                className="cow-smile"
                d="M185 239c8 8 17 12 25 12s17-4 25-12"
                fill="none"
                stroke="#4b2b27"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                className="cow-tongue"
                d="M199 251c7 13 16 13 23 0"
                fill="#ec7f84"
                stroke="#4b2b27"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
