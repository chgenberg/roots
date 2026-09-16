import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PREVIEW_TOKEN_HEX_LENGTH,
  PREVIEW_TOKEN_PREFIX,
} from "@roots/contracts";
import { getPreviewToken } from "./preview-gate";

describe("getPreviewToken", () => {
  it("uses the shared prefix and length so web middleware can match", () => {
    const password = "shared-preview-secret";
    const expected = createHash("sha256")
      .update(`${PREVIEW_TOKEN_PREFIX}${password}`)
      .digest("hex")
      .slice(0, PREVIEW_TOKEN_HEX_LENGTH);

    expect(getPreviewToken(password)).toBe(expected);
    expect(getPreviewToken(password)).toHaveLength(PREVIEW_TOKEN_HEX_LENGTH);
  });
});
