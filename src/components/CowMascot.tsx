export function CowMascot() {
  return (
    <svg
      className="cow-mascot"
      viewBox="0 0 324 240"
      role="img"
      aria-labelledby="cow-mascot-title"
    >
      <title id="cow-mascot-title">Linh vật bò Gyu-Kaku</title>
      <defs>
        <linearGradient id="cow-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf8" />
          <stop offset="1" stopColor="#f4eadc" />
        </linearGradient>
        <linearGradient id="cow-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ef5b4b" />
          <stop offset="1" stopColor="#bd2925" />
        </linearGradient>
        <filter id="cow-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#63211f" floodOpacity=".18" />
        </filter>
      </defs>

      <ellipse cx="162" cy="216" rx="100" ry="14" fill="#7f201c" opacity=".12" />
      <g filter="url(#cow-shadow)">
        <path d="M85 67C63 44 58 24 69 18c13-7 37 14 49 38" fill="#f2d7a6" stroke="#4b2924" strokeWidth="5" strokeLinecap="round" />
        <path d="M239 67c22-23 27-43 16-49-13-7-37 14-49 38" fill="#f2d7a6" stroke="#4b2924" strokeWidth="5" strokeLinecap="round" />
        <path d="M91 72C60 64 41 72 43 87c2 14 28 18 51 7" fill="#dca6a0" stroke="#4b2924" strokeWidth="5" />
        <path d="M233 72c31-8 50 0 48 15-2 14-28 18-51 7" fill="#dca6a0" stroke="#4b2924" strokeWidth="5" />
        <path d="M162 34c60 0 96 40 88 105-7 57-43 77-88 77s-81-20-88-77c-8-65 28-105 88-105Z" fill="url(#cow-body)" stroke="#4b2924" strokeWidth="6" />
        <path d="M105 59c17-18 42-24 57-22-3 30-23 49-55 49-7-8-8-18-2-27Z" fill="#53322d" />
        <path d="M210 46c23 13 36 34 38 58-24 2-42-8-51-29 1-14 5-23 13-29Z" fill="#53322d" />
        <path d="M112 109c13-13 30-13 40-2-6 17-20 27-39 23-6-7-7-14-1-21Z" fill="#53322d" />
        <circle cx="127" cy="102" r="7" fill="#35201d" />
        <circle cx="201" cy="102" r="7" fill="#35201d" />
        <circle cx="124.5" cy="99.5" r="2" fill="#fff" />
        <circle cx="198.5" cy="99.5" r="2" fill="#fff" />
        <path d="M114 148c0-22 20-35 48-35s48 13 48 35-20 38-48 38-48-16-48-38Z" fill="#e7aaa5" stroke="#4b2924" strokeWidth="5" />
        <ellipse cx="140" cy="147" rx="5" ry="7" fill="#75413c" />
        <ellipse cx="184" cy="147" rx="5" ry="7" fill="#75413c" />
        <path d="M147 166c8 5 20 5 30 0" fill="none" stroke="#4b2924" strokeWidth="4" strokeLinecap="round" />
        <path d="M91 181c-19 7-31 20-36 39M233 181c19 7 31 20 36 39" fill="none" stroke="#4b2924" strokeWidth="7" strokeLinecap="round" />
        <path d="M83 194c18 9 37 15 57 17M241 194c-18 9-37 15-57 17" fill="none" stroke="url(#cow-accent)" strokeWidth="11" strokeLinecap="round" />
      </g>
    </svg>
  );
}
