import { isValidUsername } from "../_shared/username.ts";

export type BootstrapAdminInput = {
  username: string;
  password: string;
};

export type BootstrapApiError = {
  status: number;
  code: string;
  message: string;
};

export class BootstrapInputError extends Error {
  constructor(
    readonly code: "INVALID_USERNAME" | "WEAK_PASSWORD" | "INVALID_REQUEST",
    message: string,
  ) {
    super(message);
  }
}

export function parseBootstrapAdminInput(
  body: Record<string, unknown>,
): BootstrapAdminInput {
  if (typeof body.username !== "string" || !isValidUsername(body.username)) {
    throw new BootstrapInputError(
      "INVALID_USERNAME",
      "Tên đăng nhập chỉ được chứa chữ cái và số, từ 3 đến 32 ký tự.",
    );
  }
  if (typeof body.password !== "string" || body.password.length > 128) {
    throw new BootstrapInputError("INVALID_REQUEST", "Mật khẩu không hợp lệ.");
  }
  if (body.password.length < 8) {
    throw new BootstrapInputError(
      "WEAK_PASSWORD",
      "Mật khẩu phải có ít nhất 8 ký tự.",
    );
  }
  return { username: body.username, password: body.password };
}

export function mapBootstrapRpcError(error: {
  code?: string | null;
  message?: string | null;
}): BootstrapApiError {
  if (error.message?.includes("ADMIN_ALREADY_EXISTS")) {
    return {
      status: 409,
      code: "SETUP_COMPLETE",
      message: "Hệ thống đã được thiết lập.",
    };
  }
  if (error.code === "23505") {
    return {
      status: 409,
      code: "USERNAME_EXISTS",
      message: "Tên đăng nhập này đã được sử dụng.",
    };
  }
  return {
    status: 500,
    code: "BOOTSTRAP_FAILED",
    message: "Không thể tạo tài khoản Admin.",
  };
}
