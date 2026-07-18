#!/usr/bin/env node
/**
 * License issuance CLI (vendor-only).
 *
 * Usage:
 *   node scripts/issue-license.mjs \
 *     --institution "St. Xavier's High School" \
 *     --expires 2027-07-18 \
 *     --max-students 2000
 *
 * First run generates an ed25519 keypair at .keys/license-*.b64 and prints
 * the LICENSE_PUBLIC_KEY value you must set in the customer's .env. Keep
 * .keys/license-private.b64 secret — never commit it, never share it.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { getPublicKey, sign, utils } from "@noble/ed25519";

function toB64Url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return new Uint8Array(Buffer.from(s + "=".repeat(pad), "base64"));
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  return out;
}

async function ensureKeys() {
  mkdirSync(".keys", { recursive: true });
  const privPath = ".keys/license-private.b64";
  const pubPath = ".keys/license-public.b64";
  if (!existsSync(privPath)) {
    const priv = utils.randomSecretKey();
    const pub = await getPublicKey(priv);
    writeFileSync(privPath, toB64Url(priv));
    writeFileSync(pubPath, toB64Url(pub));
    console.log("Generated new signing keypair in .keys/");
    console.log("Set this in the customer's .env:");
    console.log(`  LICENSE_PUBLIC_KEY=${toB64Url(pub)}`);
    console.log("");
  }
  return {
    priv: fromB64Url(readFileSync(".keys/license-private.b64", "utf8")),
    pub: readFileSync(".keys/license-public.b64", "utf8"),
  };
}

const args = parseArgs(process.argv);
if (!args.institution) {
  console.error("Missing --institution");
  process.exit(1);
}

const { priv, pub } = await ensureKeys();

const payload = {
  institution: args.institution,
  issuedAt: new Date().toISOString().slice(0, 10),
  expiresAt: args.expires ?? null,
  maxStudents: Number(args["max-students"] ?? 0),
  features: (args.features ?? "*").split(","),
};

const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
const sig = await sign(payloadBytes, priv);
const licenseKey = `${toB64Url(payloadBytes)}.${toB64Url(sig)}`;

console.log("License key:");
console.log(licenseKey);
console.log("");
console.log("Public key (embed in customer .env as LICENSE_PUBLIC_KEY):");
console.log(pub);
