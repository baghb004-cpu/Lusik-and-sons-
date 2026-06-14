// ============================================================
// Business App — optional at-rest encryption (§30, encrypted DB)
// ============================================================
// Browser WebCrypto (AES-256-GCM + PBKDF2). Lets a generated business
// app lock its local data behind a passphrase. No passphrase ⇒ no
// decryption, no recovery — that's the guarantee. Marker BAPP1.
// ============================================================

const MAGIC = "BAPP1";
const ITERS = 210_000;
const te = new TextEncoder();
const td = new TextDecoder();

function b64e(b: Uint8Array): string { let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
function b64d(s: string): Uint8Array { const bin = atob(s); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
const ab = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

async function key(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", ab(te.encode(pass)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: ab(salt), iterations: ITERS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Encrypt any JSON value → a self-describing base64 blob. */
export async function encryptData(value: unknown, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 8) throw new Error("Passphrase must be at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await key(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(iv) }, k, ab(te.encode(JSON.stringify(value)))));
  const header = te.encode(MAGIC);
  const out = new Uint8Array(header.length + salt.length + iv.length + ct.length);
  let o = 0; out.set(header, o); o += header.length; out.set(salt, o); o += salt.length; out.set(iv, o); o += iv.length; out.set(ct, o);
  return b64e(out);
}

/** True if a stored string is one of our encrypted blobs. */
export function isEncrypted(blob: string): boolean {
  try { return td.decode(b64d(blob.trim()).subarray(0, MAGIC.length)) === MAGIC; } catch { return false; }
}

/** Decrypt; wrong passphrase or tampering throws. */
export async function decryptData<T = unknown>(blob: string, passphrase: string): Promise<T> {
  let buf: Uint8Array;
  try { buf = b64d(blob.trim()); } catch { throw new Error("That isn't an encrypted data file."); }
  if (td.decode(buf.subarray(0, MAGIC.length)) !== MAGIC) throw new Error("Not a recognized encrypted file.");
  let o = MAGIC.length;
  const salt = buf.subarray(o, (o += 16)), iv = buf.subarray(o, (o += 12)), ct = buf.subarray(o);
  const k = await key(passphrase, salt);
  try { return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: ab(iv) }, k, ab(ct)))) as T; }
  catch { throw new Error("Wrong passphrase, or the data is corrupted."); }
}
