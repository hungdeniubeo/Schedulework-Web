import { getPublicSupabaseConfig } from "./config";

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

export type TemporaryCredentials = {
  email: string;
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

export async function createEmployeeAccount(input: {
  name: string;
  email: string;
  accessToken: string;
}): Promise<TemporaryCredentials> {
  const result = await callAdminUsers<
    TemporaryCredentials & {
      employee: { id: string; userId: string; name: string; active: boolean };
    }
  >(input.accessToken, {
    action: "create-employee",
    name: input.name,
    email: input.email,
  });
  return { email: result.email, temporaryPassword: result.temporaryPassword };
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