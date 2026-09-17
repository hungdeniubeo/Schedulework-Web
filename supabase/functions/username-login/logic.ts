import { isValidUsername } from "../_shared/username.ts";

export type UsernameLoginInput = {
  username: string;
  password: string;
};

export class LoginInputError extends Error {
  constructor(
    readonly code: "INVALID_USERNAME" | "INVALID_REQUEST",
    message: string,
  ) {
    super(message);
  }
}

export function parseUsernameLoginInput(
  body: Record<string, unknown>,
): UsernameLoginInput {
  if (typeof body.username !== "string" || !isValidUsername(body.username)) {
    throw new LoginInputError(
      "INVALID_USERNAME",
      "Tên đăng nhập không hợp lệ.",
    );
  }
  if (
    typeof body.password !== "string"
    || body.password.length === 0
    || body.password.length > 128
  ) {
    throw new LoginInputError("INVALID_REQUEST", "Mật khẩu không hợp lệ.");
  }
  return { username: body.username, password: body.password };
}
