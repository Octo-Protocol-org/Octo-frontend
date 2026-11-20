import { describe, it, expect } from "vitest";
import { validateRedirectUrl } from "./redirectUrl";

describe("validateRedirectUrl", () => {
  const accept = [
    "https://shop.example/",
    "https://shop.example/thanks?x=1#a",
    "https://shop.example:8443/path",
    "https://sub.shop.example./",
  ];
  const reject = [
    "https://localhost./",
    "https://localhost/",
    "https://app.localhost./",
    "https://user:pass@shop.example/",
    "https://octo.dev@evil.example/",
    "https://[::1]/",
    "https://[2001:db8::1]/",
    "https://127.0.0.1/",
    "javascript:alert(1)",
    "data:text/html,hi",
    "http://shop.example/",
    "https://intranet/",
    `https://shop.example/${"a".repeat(2048)}`,
    "",
  ];
  it.each(accept)("accepts %s", (u) => expect(validateRedirectUrl(u)).toBeNull());
  it.each(reject)("rejects %s", (u) => expect(validateRedirectUrl(u)).not.toBeNull());
});
