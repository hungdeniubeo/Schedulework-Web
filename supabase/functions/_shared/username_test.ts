import {
  assertEquals,
  assertMatch,
} from "jsr:@std/assert@1";
import {
  createInternalAuthEmail,
  isValidUsername,
} from "./username.ts";

Deno.test("username accepts ASCII letters and digits with exact case", () => {
  assertEquals(isValidUsername("Hung01"), true);
  assertEquals(isValidUsername("hung01"), true);
});

Deno.test("username rejects punctuation spaces unicode and invalid lengths", () => {
  for (const value of [
    "ab",
    "A".repeat(33),
    "hung_01",
    "hung.01",
    "hung 01",
    "Hùng01",
  ]) {
    assertEquals(isValidUsername(value), false);
  }
});

Deno.test("internal auth email is opaque and valid-shaped", () => {
  assertMatch(
    createInternalAuthEmail(),
    /^auth-[0-9a-f-]+@schedulework\.invalid$/,
  );
});
