import { describe, expect, it } from "vitest";
import { isRealEmailSend } from "./index";

describe("isRealEmailSend", () => {
  it("rejects missing, failed and mock results", () => {
    expect(isRealEmailSend(undefined)).toBe(false);
    expect(isRealEmailSend({ success: false })).toBe(false);
    expect(isRealEmailSend({ success: true, mocked: true })).toBe(false);
  });

  it("accepts a real provider success", () => {
    expect(isRealEmailSend({ success: true, id: "re_123" })).toBe(true);
  });
});
