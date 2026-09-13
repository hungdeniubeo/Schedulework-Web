const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%";
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${DIGITS}${SYMBOLS}`;

function randomIndex(max: number): number {
  const upperBound = Math.floor(0x1_0000_0000 / max) * max;
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value);
  while (value[0] >= upperBound);
  return value[0] % max;
}

function pick(source: string): string {
  return source[randomIndex(source.length)];
}

export function generateTemporaryPassword(length = 16): string {
  if (length < 12)
    throw new Error("Temporary password must contain at least 12 characters.");
  const characters = [
    pick(UPPERCASE),
    pick(LOWERCASE),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  while (characters.length < length) characters.push(pick(ALL_CHARACTERS));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }
  return characters.join("");
}
