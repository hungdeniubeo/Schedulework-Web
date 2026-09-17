import {
  assertEquals,
  assertThrows,
} from "jsr:@std/assert@1";
import {
  LoginInputError,
  parseUsernameLoginInput,
} from "./logic.ts";

Deno.test("username login preserves exact case", () => {
  assertEquals(
    parseUsernameLoginInput({ username: "Hung01", password: "password123" }),
    { username: "Hung01", password: "password123" },
  );
});

Deno.test("username login rejects invalid username syntax", () => {
  const error = assertThrows(
    () => parseUsernameLoginInput({ username: "hung_01", password: "password123" }),
    LoginInputError,
  );
  assertEquals(error.code, "INVALID_USERNAME");
});

Deno.test("username login rejects missing password", () => {
  const error = assertThrows(
    () => parseUsernameLoginInput({ username: "Hung01" }),
    LoginInputError,
  );
  assertEquals(error.code, "INVALID_REQUEST");
});
