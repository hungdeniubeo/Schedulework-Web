import {
  assertEquals,
  assertThrows,
} from "jsr:@std/assert@1";
import {
  BootstrapInputError,
  mapBootstrapRpcError,
  parseBootstrapAdminInput,
} from "./logic.ts";

Deno.test("bootstrap preserves exact username case", () => {
  assertEquals(
    parseBootstrapAdminInput({ username: "Admin01", password: "Password123" }),
    { username: "Admin01", password: "Password123" },
  );
});

Deno.test("bootstrap rejects non alphanumeric username", () => {
  const error = assertThrows(
    () => parseBootstrapAdminInput({ username: "Admin_01", password: "Password123" }),
    BootstrapInputError,
  );
  assertEquals(error.code, "INVALID_USERNAME");
});

Deno.test("bootstrap requires at least eight password characters", () => {
  const error = assertThrows(
    () => parseBootstrapAdminInput({ username: "Admin01", password: "short" }),
    BootstrapInputError,
  );
  assertEquals(error.code, "WEAK_PASSWORD");
});

Deno.test("bootstrap maps an existing admin to setup complete", () => {
  assertEquals(mapBootstrapRpcError({ message: "ADMIN_ALREADY_EXISTS" }), {
    status: 409,
    code: "SETUP_COMPLETE",
    message: "Hệ thống đã được thiết lập.",
  });
});

Deno.test("bootstrap maps exact duplicate username to conflict", () => {
  assertEquals(mapBootstrapRpcError({ code: "23505" }), {
    status: 409,
    code: "USERNAME_EXISTS",
    message: "Tên đăng nhập này đã được sử dụng.",
  });
});
