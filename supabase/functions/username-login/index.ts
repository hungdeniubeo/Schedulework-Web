import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  LoginInputError,
  parseUsernameLoginInput,
} from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store" },
  });
}

function invalidCredentials(): Response {
  return json(
    {
      error: "Tên đăng nhập hoặc mật khẩu không đúng.",
      code: "INVALID_CREDENTIALS",
    },
    401,
  );
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(
        { error: "Máy chủ chưa được cấu hình.", code: "SERVER_CONFIG" },
        500,
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { username, password } = parseUsernameLoginInput(body);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const profile = await admin
      .from("profiles")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();
    if (profile.error) {
      console.error(profile.error);
      return json(
        { error: "Máy chủ gặp lỗi. Vui lòng thử lại.", code: "INTERNAL_ERROR" },
        500,
      );
    }
    if (!profile.data) return invalidCredentials();

    const authUser = await admin.auth.admin.getUserById(profile.data.user_id);
    const email = authUser.data.user?.email;
    if (authUser.error || !email) return invalidCredentials();

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await publicClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signedIn.error || !signedIn.data.session) return invalidCredentials();

    return json({
      accessToken: signedIn.data.session.access_token,
      refreshToken: signedIn.data.session.refresh_token,
    });
  } catch (reason) {
    if (reason instanceof LoginInputError) {
      return json({ error: reason.message, code: reason.code }, 400);
    }
    console.error(reason);
    return json(
      { error: "Máy chủ gặp lỗi. Vui lòng thử lại.", code: "INTERNAL_ERROR" },
      500,
    );
  }
});
