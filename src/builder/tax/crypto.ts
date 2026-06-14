// ============================================================
// Tax Assistant — local at-rest encryption (server-only, plan §25)
// ============================================================
// The tax project is the most sensitive thing on the drive (SSNs,
// W-2 figures). It's stored as ONE encrypted blob: AES-256-GCM
// with a key derived from the user's passphrase via scrypt. Node's
// built-in crypto only — no dependency, runs from the thumb drive.
// No passphrase ⇒ no decryption. There is no recovery path by
// design (that's the privacy guarantee); the UI says so loudly.
// ============================================================

import { randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";

const MAGIC = "BTAX1"; // file format marker
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 32, maxmem: 96 * 1024 * 1024 };

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem });
}

/** Encrypt a JS value → a self-describing base64 blob (salt+iv+tag inside). */
export function encryptProject(value: unknown, passphrase: string): string {
  if (!passphrase || passphrase.length < 8) throw new Error("Passphrase must be at least 8 characters.");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const header = Buffer.from(MAGIC, "utf8");
  return Buffer.concat([header, salt, iv, tag, enc]).toString("base64");
}

/** Decrypt; wrong passphrase or tampering throws (GCM auth). */
export function decryptProject<T = unknown>(blobBase64: string, passphrase: string): T {
  const buf = Buffer.from(blobBase64, "base64");
  const magic = buf.subarray(0, MAGIC.length);
  if (!(magic.length === MAGIC.length && timingSafeEqual(magic, Buffer.from(MAGIC, "utf8")))) {
    throw new Error("Not a recognized tax project file.");
  }
  let o = MAGIC.length;
  const salt = buf.subarray(o, (o += 16));
  const iv = buf.subarray(o, (o += 12));
  const tag = buf.subarray(o, (o += 16));
  const enc = buf.subarray(o);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    throw new Error("Wrong passphrase, or the file is corrupted/tampered with.");
  }
}
