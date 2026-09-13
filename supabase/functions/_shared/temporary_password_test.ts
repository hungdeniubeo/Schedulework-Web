import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { generateTemporaryPassword } from "./temporary_password.ts";

Deno.test(
  "generates unique strong temporary passwords without storing state",
  () => {
    const passwords = Array.from({ length: 100 }, () =>
      generateTemporaryPassword(),
    );

    assertEquals(new Set(passwords).size, passwords.length);
    for (const password of passwords) {
      assert(password.length >= 16);
      assertMatch(password, /[A-Z]/);
      assertMatch(password, /[a-z]/);
      assertMatch(password, /[0-9]/);
      assertMatch(password, /[^A-Za-z0-9]/);
    }
  },
);
