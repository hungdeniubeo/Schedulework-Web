const USERNAME_PATTERN = /^[A-Za-z0-9]{3,32}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function createInternalAuthEmail(): string {
  return `auth-${crypto.randomUUID()}@schedulework.invalid`;
}
