import "../styles/CowMascot.css";

const GYU_KAKU_LOGO_URL =
  "https://gyu-kaku.com.vn/wp-content/uploads/2026/01/gyukaku-logo.webp";

export function CowMascot() {
  return (
    <svg
      className="cow-mascot"
      viewBox="0 0 360 300"
      role="img"
      aria-labelledby="cow-mascot-title"
    >
      <title id="cow-mascot-title">Linh vật bò Gyu-Kaku chibi</title>

      <defs>
        <linearGradient id="cow-fur" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf8" />
          <stop offset="1" stopColor="#f4e7d6" />
        </linearGradient>

        <linearGradient id="cow-muzzle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4bbb4" />
          <stop offset="1" stopColor="#dfa09b" />
        </linearGradient>

        <linearGradient id="cow-apron" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ef5b4b" />
          <stop offset="1" stopColor="#b82020" />
        </linearGradient>

        <radialGradient id="cow-eye-water" cx="34%" cy="24%" r="78%">
          <stop offset="0" stopColor="#6a4b46" />
          <stop offset="0.38" stopColor="#3b2926" />
          <stop offset="0.72" stopColor="#251918" />
          <stop offset="1" stopColor="#120d0c" />
        </radialGradient>

        <filter id="cow-soft-shadow" x="-35%" y="-35%" width="170%" height="190%">
          <feDropShadow
            dx="0"
            dy="10"
            stdDeviation="9"
            floodColor="#5e231e"
            floodOpacity=".18"
          />
        </filter>
      </defs>

      <ellipse
        className="cow-ground-shadow"
        cx="180"
        cy="276"
        rx="92"
        ry="13"
        fill="#6f211d"
        opacity=".14"
      />

      <g className="cow-character" filter="url(#cow-soft-shadow)">
        {/* Body */}
        <ellipse
          className="cow-body"
          cx="180"
          cy="218"
          rx="76"
          ry="63"
          fill="url(#cow-fur)"
          stroke="#4b2a25"
          strokeWidth="6"
        />

        {/* Legs */}
        <g className="cow-legs">
          <path
            d="M139 247c-5 18-5 28 2 31 9 4 17-3 18-18"
            fill="none"
            stroke="#4b2a25"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M221 247c5 18 5 28-2 31-9 4-17-3-18-18"
            fill="none"
            stroke="#4b2a25"
            strokeWidth="13"
            strokeLinecap="round"
          />
        </g>

        {/* Apron */}
        <path
          className="cow-apron"
          d="M132 204c12-18 84-18 96 0l-8 68c-24 12-56 12-80 0Z"
          fill="url(#cow-apron)"
          stroke="#8f1d1d"
          strokeWidth="4"
        />
        <path
          d="M147 214c21 9 45 9 66 0"
          fill="none"
          stroke="#ffd8cb"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".9"
        />

        {/* Gyu-Kaku logo badge */}
        <g className="cow-apron-logo" aria-hidden="true">
          <rect
            x="148"
            y="222"
            width="64"
            height="30"
            rx="10"
            fill="#fff"
            stroke="#f3c9bf"
            strokeWidth="2"
          />
          <image
            href={GYU_KAKU_LOGO_URL}
            x="153"
            y="226"
            width="54"
            height="22"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>

        {/* Real arms */}
        <g className="cow-arm cow-arm-left">
          <path
            d="M126 205c-24 3-38 17-44 34"
            fill="none"
            stroke="#f5eadb"
            strokeWidth="24"
            strokeLinecap="round"
          />
          <path
            d="M126 205c-24 3-38 17-44 34"
            fill="none"
            stroke="#4b2a25"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="80" cy="241" r="13" fill="#f5eadb" stroke="#4b2a25" strokeWidth="5" />
        </g>

        <g className="cow-arm cow-arm-right">
          <path
            d="M234 205c24 3 38 17 44 34"
            fill="none"
            stroke="#f5eadb"
            strokeWidth="24"
            strokeLinecap="round"
          />
          <path
            d="M234 205c24 3 38 17 44 34"
            fill="none"
            stroke="#4b2a25"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="280" cy="241" r="13" fill="#f5eadb" stroke="#4b2a25" strokeWidth="5" />
        </g>

        {/* Head */}
        <g className="cow-head">
          {/* Horns */}
          <path
            className="cow-horn cow-horn-left"
            d="M120 72c-22-21-20-42-8-45 13-3 25 13 31 35"
            fill="#f3d39c"
            stroke="#4b2a25"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            className="cow-horn cow-horn-right"
            d="M240 72c22-21 20-42 8-45-13-3-25 13-31 35"
            fill="#f3d39c"
            stroke="#4b2a25"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Ears */}
          <g className="cow-ear cow-ear-left">
            <path
              d="M129 78c-31-17-58-11-62 6-4 18 25 30 58 17Z"
              fill="#f4e7d6"
              stroke="#4b2a25"
              strokeWidth="6"
            />
            <path d="M112 87c-17-7-28-4-31 2 7 7 17 9 30 7Z" fill="#e9aaa6" />
          </g>

          <g className="cow-ear cow-ear-right">
            <path
              d="M231 78c31-17 58-11 62 6 4 18-25 30-58 17Z"
              fill="#f4e7d6"
              stroke="#4b2a25"
              strokeWidth="6"
            />
            <path d="M248 87c17-7 28-4 31 2-7 7-17 9-30 7Z" fill="#e9aaa6" />
          </g>

          {/* Face */}
          <path
            d="M180 52c61 0 102 38 96 101-5 54-42 83-96 83s-91-29-96-83c-6-63 35-101 96-101Z"
            fill="url(#cow-fur)"
            stroke="#4b2a25"
            strokeWidth="6"
          />

          {/* Spots */}
          <path
            d="M116 73c18-14 38-16 52-7-4 26-23 40-49 35-8-8-10-18-3-28Z"
            fill="#55342f"
          />
          <path
            d="M226 67c23 12 35 31 34 54-20 4-38-5-48-23 0-14 5-24 14-31Z"
            fill="#55342f"
          />

          {/* Eyes */}
          <g className="cow-eye cow-eye-left">
            <ellipse
              className="cow-eye-ball"
              cx="145"
              cy="127"
              rx="13"
              ry="16"
              fill="url(#cow-eye-water)"
            />
            <ellipse
              className="cow-eye-depth"
              cx="145"
              cy="134"
              rx="8.5"
              ry="4.2"
              fill="#9a6e68"
              opacity=".16"
            />
            <path
              className="cow-eye-waterline"
              d="M137 136c5 3 11 3 16 0"
              fill="none"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity=".22"
            />
            <circle
              className="cow-eye-highlight cow-eye-highlight-main"
              cx="140"
              cy="120"
              r="4.6"
              fill="#fff"
            />
            <circle
              className="cow-eye-highlight cow-eye-highlight-small"
              cx="151"
              cy="131"
              r="2.3"
              fill="#fff"
              opacity=".88"
            />
            <path
              className="cow-eye-sparkle cow-eye-sparkle-a"
              d="M154 116l1.3 2.8 2.8 1.3-2.8 1.3-1.3 2.8-1.3-2.8-2.8-1.3 2.8-1.3Z"
              fill="#fff"
            />
            <circle
              className="cow-eye-sparkle cow-eye-sparkle-b"
              cx="136"
              cy="130"
              r="1.4"
              fill="#fff"
            />
          </g>

          <g className="cow-eye cow-eye-right">
            <ellipse
              className="cow-eye-ball"
              cx="215"
              cy="127"
              rx="13"
              ry="16"
              fill="url(#cow-eye-water)"
            />
            <ellipse
              className="cow-eye-depth"
              cx="215"
              cy="134"
              rx="8.5"
              ry="4.2"
              fill="#9a6e68"
              opacity=".16"
            />
            <path
              className="cow-eye-waterline"
              d="M207 136c5 3 11 3 16 0"
              fill="none"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity=".22"
            />
            <circle
              className="cow-eye-highlight cow-eye-highlight-main"
              cx="210"
              cy="120"
              r="4.6"
              fill="#fff"
            />
            <circle
              className="cow-eye-highlight cow-eye-highlight-small"
              cx="221"
              cy="131"
              r="2.3"
              fill="#fff"
              opacity=".88"
            />
            <path
              className="cow-eye-sparkle cow-eye-sparkle-a"
              d="M224 116l1.3 2.8 2.8 1.3-2.8 1.3-1.3 2.8-1.3-2.8-2.8-1.3 2.8-1.3Z"
              fill="#fff"
            />
            <circle
              className="cow-eye-sparkle cow-eye-sparkle-b"
              cx="206"
              cy="130"
              r="1.4"
              fill="#fff"
            />
          </g>

          {/* Blush */}
          <ellipse className="cow-cheek cow-cheek-left" cx="120" cy="158" rx="17" ry="8" fill="#f4a7a7" opacity=".56" />
          <ellipse className="cow-cheek cow-cheek-right" cx="240" cy="158" rx="17" ry="8" fill="#f4a7a7" opacity=".56" />

          {/* Muzzle */}
          <path
            className="cow-muzzle"
            d="M128 171c0-27 23-42 52-42s52 15 52 42-22 45-52 45-52-18-52-45Z"
            fill="url(#cow-muzzle)"
            stroke="#4b2a25"
            strokeWidth="5"
          />
          <ellipse cx="157" cy="169" rx="5" ry="7" fill="#76433e" />
          <ellipse cx="203" cy="169" rx="5" ry="7" fill="#76433e" />

          {/* Smile */}
          <path
            className="cow-smile"
            d="M161 188c11 10 27 10 38 0"
            fill="none"
            stroke="#4b2a25"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            className="cow-tongue"
            d="M175 196c4 5 8 5 12 0"
            fill="none"
            stroke="#c95f68"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
