#!/usr/bin/env node
/**
 * License issuance CLI (vendor-only, offline).
 *
 * Usage:
 *   node scripts/issue-license.mjs \
 *     --institution "St. Xavier's High School" \
 *     --slug st-xaviers \
 *     --tier pro
 *
 * First run generates an ed25519 keypair at .keys/license-*.b64 and prints the
 * LICENSE_PUBLIC_KEY value to set in the customer's .env. Keep
 * .keys/license-private.b64 secret — never commit it, never share it.
 *
 * Notes:
 *  - Keys DO NOT expire (product decision). --slug binds the key to a school
 *    identifier so it can only be activated on that school (tenant binding).
 *  - Token format: base64url(payloadJSON).base64url(ed25519-signature), the
 *    exact format the app verifies (see src/lib/license-crypto.server.ts).
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";

const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  return out;
}

function ensureKeys() {
  mkdirSync(".keys", { recursive: true });
  const privPath = ".keys/license-private.b64";
  const pubPath = ".keys/license-public.b64";
  if (!existsSync(privPath)) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const priv = privateKey.export({ format: "jwk" }).d; // raw seed, base64url
    const pub = publicKey.export({ format: "jwk" }).x; // raw pub, base64url
    writeFileSync(privPath, priv);
    writeFileSync(pubPath, pub);
    console.log("Generated new signing keypair in .keys/");
    console.log("Set this in the customer's .env:");
    console.log(`  LICENSE_PUBLIC_KEY=${pub}`);
    console.log("");
  }
  return {
    priv: readFileSync(privPath, "utf8").trim(),
    pub: readFileSync(pubPath, "utf8").trim(),
  };
}

function privateKeyFromRaw(rawB64url) {
  const der = Buffer.concat([PKCS8_PREFIX, Buffer.from(rawB64url, "base64url")]);
  return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

const args = parseArgs(process.argv);
if (!args.institution) {
  console.error("Missing --institution");
  process.exit(1);
}
const tier = args.tier ?? "pro";
if (!["starter", "pro", "max"].includes(tier)) {
  console.error(`Invalid --tier "${tier}" (expected starter | pro | max)`);
  process.exit(1);
}

const { priv, pub } = ensureKeys();

const payload = {
  institution: args.institution,
  slug: args.slug ?? null,
  tier,
  issuedAt: new Date().toISOString().slice(0, 10),
  maxStudents: Number(args["max-students"] ?? 0),
  features: (args.features ?? "*").split(","),
};

const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
const sig = crypto.sign(null, payloadBytes, privateKeyFromRaw(priv));
const licenseKey = `${b64url(payloadBytes)}.${b64url(sig)}`;

console.log(`Tier: ${tier}${payload.slug ? ` · bound to "${payload.slug}"` : " · unbound"}`);
console.log("License key:");
console.log(licenseKey);
console.log("");
console.log("Public key (embed in customer .env as LICENSE_PUBLIC_KEY):");
console.log(pub);
