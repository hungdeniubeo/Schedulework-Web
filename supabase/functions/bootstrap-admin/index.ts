import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.116.0";
import { createInternalAuthEmail } from "../_shared/username.ts";
import {
  BootstrapInputError,
  mapBootstrapRpcError,
  parseBootstrapAdminInput,
} from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function setupAvailable(admin: SupabaseClient): Promise<boolean> {
  const result = await admin
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (result.error) throw result.error;
  return (result.count ?? 0) === 0;
}

async function bootstrapAdmin(
  body: Record<string, unknown>,
  admin: SupabaseClient,
) {
  if (!(await setupAvailable(admin))) {
    throw new ApiError(409, "SETUP_COMPLETE", "Hệ thống đã được thiết lập.");
  }

  const { username, password } = parseBootstrapAdminInput(body);
  const created = await admin.auth.admin.createUser({
    email: createInternalAuthEmail(),
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    console.error(created.error);
    throw new ApiError(
      500,
      "CREATE_USER_FAILED",
      "Không thể tạo tài khoản Admin.",
    );
  }

  const authUser = created.data.user;
  const provisioned = await admin.rpc("bootstrap_first_admin", {
    auth_user_id: authUser.id,
    account_username: username,
  });
  if (provisioned.error || !provisioned.data) {
    console.error(provisioned.error);
    const mapped = mapBootstrapRpcError(provisioned.error ?? {});
    const cleanup = await admin.auth.admin.deleteUser(authUser.id);
    if (cleanup.error) {
      console.error(cleanup.error);
      throw new ApiError(
        500,
        "BOOTSTRAP_ROLLBACK_FAILED",
        "Không thể hoàn tác tài khoản Auth sau khi thiết lập thất bại.",
      );
    }
    throw new ApiError(mapped.status, mapped.code, mapped.message);
  }

  return { created: true };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    if (request.method === "GET") {
      return json({ available: await setupAvailable(admin) });
    }
    if (request.method !== "POST") {
      return json(
        { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
        405,
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    return json(await bootstrapAdmin(body, admin), 201);
  } catch (reason) {
    console.error(reason);
    if (reason instanceof BootstrapInputError) {
      return json({ error: reason.message, code: reason.code }, 400);
    }
    if (reason instanceof ApiError) {
      return json({ error: reason.message, code: reason.code }, reason.status);
    }
    return json(
      { error: "Máy chủ gặp lỗi. Vui lòng thử lại.", code: "INTERNAL_ERROR" },
      500,
    );
  }
});
