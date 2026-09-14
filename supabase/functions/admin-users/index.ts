import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.116.0";
import { generateTemporaryPassword } from "../_shared/temporary_password.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store" },
  });
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new ApiError(400, "INVALID_REQUEST", `${field} không hợp lệ.`);
  }
  return value.trim();
}

async function authenticatedUser(request: Request, admin: SupabaseClient) {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    throw new ApiError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập lại.");
  }
  const { data, error } = await admin.auth.getUser(authorization.slice(7));
  if (error || !data.user) {
    throw new ApiError(401, "AUTH_REQUIRED", "Phiên đăng nhập không hợp lệ.");
  }
  return data.user;
}

async function requireAdmin(request: Request, admin: SupabaseClient) {
  const user = await authenticatedUser(request, admin);
  const membership = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (membership.error) throw membership.error;
  if (!membership.data) {
    throw new ApiError(403, "ADMIN_REQUIRED", "Không có quyền truy cập.");
  }
}

async function requireActiveEmployee(request: Request, admin: SupabaseClient) {
  const user = await authenticatedUser(request, admin);
  const [profile, employee] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("role", "employee")
      .maybeSingle(),
    admin
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (employee.error) throw employee.error;
  if (!profile.data || !employee.data) {
    throw new ApiError(
      403,
      "EMPLOYEE_REQUIRED",
      "Tài khoản nhân viên không hoạt động.",
    );
  }
  return user;
}

async function createEmployee(
  request: Request,
  body: Record<string, unknown>,
  admin: SupabaseClient,
) {
  await requireAdmin(request, admin);
  const name = requiredString(body.name, "Tên nhân viên", 120);
  const email = requiredString(body.email, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "INVALID_EMAIL", "Email không hợp lệ.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const created = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    console.error(created.error);
    throw new ApiError(
      created.error?.status === 422 ? 409 : 500,
      created.error?.status === 422 ? "EMAIL_EXISTS" : "CREATE_USER_FAILED",
      created.error?.status === 422
        ? "Email này đã có tài khoản."
        : "Không tạo được tài khoản nhân viên.",
    );
  }

  const authUser = created.data.user;
  const provisioned = await admin.rpc("provision_employee_account", {
    auth_user_id: authUser.id,
    employee_name: name,
  });
  if (provisioned.error || !provisioned.data) {
    console.error(provisioned.error);
    const cleanup = await admin.auth.admin.deleteUser(authUser.id);
    if (cleanup.error) {
      console.error(cleanup.error);
      throw new ApiError(
        500,
        "PROVISIONING_ROLLBACK_FAILED",
        "Tạo hồ sơ thất bại và không thể tự dọn tài khoản Auth. Hãy kiểm tra Supabase Auth.",
      );
    }
    throw new ApiError(
      500,
      "PROVISIONING_FAILED",
      "Không tạo được hồ sơ nhân viên. Tài khoản Auth đã được dọn an toàn.",
    );
  }

  return {
    employee: {
      id: provisioned.data.id,
      userId: provisioned.data.user_id,
      name: provisioned.data.name,
      active: provisioned.data.active,
    },
    email,
    temporaryPassword,
  };
}

async function resetEmployeePassword(
  request: Request,
  body: Record<string, unknown>,
  admin: SupabaseClient,
) {
  await requireAdmin(request, admin);
  const employeeId = requiredString(body.employeeId, "Nhân viên", 64);
  const employee = await admin
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (employee.error) throw employee.error;
  if (!employee.data) {
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên.");
  }

  const userId = employee.data.user_id;
  const [authUser, profile] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("profiles")
      .select("must_change_password")
      .eq("user_id", userId)
      .single(),
  ]);
  const email = authUser.data.user?.email;
  if (authUser.error || !email) {
    throw new ApiError(
      404,
      "AUTH_USER_NOT_FOUND",
      "Không tìm thấy tài khoản Auth.",
    );
  }
  if (profile.error) throw profile.error;

  const flagUpdate = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("user_id", userId);
  if (flagUpdate.error) throw flagUpdate.error;

  const temporaryPassword = generateTemporaryPassword();
  const reset = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });
  if (reset.error) {
    console.error(reset.error);
    const rollback = await admin
      .from("profiles")
      .update({ must_change_password: profile.data.must_change_password })
      .eq("user_id", userId);
    if (rollback.error) console.error(rollback.error);
    throw new ApiError(
      500,
      "RESET_FAILED",
      "Không đặt lại được mật khẩu nhân viên.",
    );
  }

  return { email, temporaryPassword };
}

async function changeOwnPassword(
  request: Request,
  body: Record<string, unknown>,
  admin: SupabaseClient,
) {
  const user = await requireActiveEmployee(request, admin);
  const password = requiredString(body.password, "Mật khẩu", 128);
  if (password.length < 8) {
    throw new ApiError(
      400,
      "WEAK_PASSWORD",
      "Mật khẩu phải có ít nhất 8 ký tự.",
    );
  }

  const changed = await admin.auth.admin.updateUserById(user.id, { password });
  if (changed.error) {
    console.error(changed.error);
    throw new ApiError(
      500,
      "PASSWORD_CHANGE_FAILED",
      "Không đổi được mật khẩu.",
    );
  }
  const completed = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", user.id)
    .eq("role", "employee");
  if (completed.error) {
    console.error(completed.error);
    throw new ApiError(
      500,
      "PASSWORD_FLAG_FAILED",
      "Mật khẩu đã đổi nhưng chưa thể hoàn tất trạng thái tài khoản. Vui lòng thử lại.",
    );
  }
  return { changed: true };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(500, "SERVER_CONFIG", "Máy chủ chưa được cấu hình.");
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "create-employee") {
      return json(await createEmployee(request, body, admin), 201);
    }
    if (body.action === "reset-employee-password") {
      return json(await resetEmployeePassword(request, body, admin));
    }
    if (body.action === "change-password") {
      return json(await changeOwnPassword(request, body, admin));
    }
    throw new ApiError(400, "UNKNOWN_ACTION", "Action không được hỗ trợ.");
  } catch (reason) {
    console.error(reason);
    if (reason instanceof ApiError) {
      return json({ error: reason.message, code: reason.code }, reason.status);
    }
    return json(
      { error: "Máy chủ gặp lỗi. Vui lòng thử lại.", code: "INTERNAL_ERROR" },
      500,
    );
  }
});
