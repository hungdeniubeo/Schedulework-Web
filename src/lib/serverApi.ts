import { getPublicSupabaseConfig, getSupabase } from "./config";

export class ServerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ServerApiError";
  }
}

type ApiErrorBody = { error?: string; code?: string };

type UsernameSession = {
  accessToken: string;
  refreshToken: string;
};

export type TemporaryCredentials = {
  username: string;
  temporaryPassword: string;
};

async function callAdminUsers<T>(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { url, publishableKey } = getPublicSupabaseConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/admin-users`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(error);
    throw new ServerApiError("Không thể kết nối máy chủ.", 0, "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!response.ok) {
    throw new ServerApiError(
      payload.error || "Yêu cầu quản lý tài khoản thất bại.",
      response.status,
      payload.code || "REQUEST_FAILED",
    );
  }
  return payload;
}

export async function signInWithUsername(
  username: string,
  password: string,
): Promise<void> {
  const { url, publishableKey } = getPublicSupabaseConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/username-login`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
  } catch (error) {
    console.error(error);
    throw new ServerApiError("Không thể kết nối máy chủ.", 0, "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody & Partial<UsernameSession>;
  if (!response.ok || !payload.accessToken || !payload.refreshToken) {
    throw new ServerApiError(
      payload.error || "Tên đăng nhập hoặc mật khẩu không đúng.",
      response.status,
      payload.code || "INVALID_CREDENTIALS",
    );
  }

  const { error } = await getSupabase().auth.setSession({
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
  });
  if (error) {
    console.error(error);
    throw new ServerApiError(
      "Không thể tạo phiên đăng nhập.",
      500,
      "SESSION_FAILED",
    );
  }
}

export async function createEmployeeAccount(input: {
  name: string;
  username: string;
  accessToken: string;
}): Promise<TemporaryCredentials> {
  const result = await callAdminUsers<
    TemporaryCredentials & {
      employee: { id: string; userId: string; name: string; active: boolean };
    }
  >(input.accessToken, {
    action: "create-employee",
    name: input.name,
    username: input.username,
  });
  return {
    username: result.username,
    temporaryPassword: result.temporaryPassword,
  };
}

export function resetEmployeePassword(
  employeeId: string,
  accessToken: string,
): Promise<TemporaryCredentials> {
  return callAdminUsers(accessToken, {
    action: "reset-employee-password",
    employeeId,
  });
}

export async function deleteEmployeeAccount(
  employeeId: string,
  accessToken: string,
): Promise<void> {
  await callAdminUsers<{ deleted: true }>(accessToken, {
    action: "delete-employee",
    employeeId,
  });
}

export async function changeEmployeePassword(
  password: string,
  accessToken: string,
): Promise<void> {
  await callAdminUsers<{ changed: true }>(accessToken, {
    action: "change-password",
    password,
  });
}
