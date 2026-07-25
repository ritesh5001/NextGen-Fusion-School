import { describe, it, expect } from "vitest";
import {
  generateKeypair,
  signLicense,
  verifyLicenseToken,
} from "@/lib/license-crypto.server";

describe("license-crypto (signed license keys)", () => {
  const { privateKey, publicKey } = generateKeypair();

  it("round-trips a signed payload", () => {
    const payload = { institution: "Test School", slug: "test", tier: "pro" };
    const token = signLicense(payload, privateKey);
    expect(verifyLicenseToken(token, publicKey)).toMatchObject(payload);
  });

  it("rejects a forged payload signed with the same signature", () => {
    const token = signLicense({ tier: "starter" }, privateKey);
    const sig = token.split(".")[1];
    const forged =
      Buffer.from(JSON.stringify({ tier: "max" })).toString("base64url") +
      "." +
      sig;
    expect(verifyLicenseToken(forged, publicKey)).toBeNull();
  });

  it("rejects a token signed by a different key", () => {
    const token = signLicense({ tier: "max" }, privateKey);
    const other = generateKeypair();
    expect(verifyLicenseToken(token, other.publicKey)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyLicenseToken("garbage", publicKey)).toBeNull();
    expect(verifyLicenseToken("", publicKey)).toBeNull();
    expect(verifyLicenseToken("a.b.c", publicKey)).toBeNull();
    expect(verifyLicenseToken("onlyonepart", publicKey)).toBeNull();
  });

  it("generates distinct keypairs", () => {
    const a = generateKeypair();
    const b = generateKeypair();
    expect(a.privateKey).not.toEqual(b.privateKey);
    expect(a.publicKey).not.toEqual(b.publicKey);
  });
});
