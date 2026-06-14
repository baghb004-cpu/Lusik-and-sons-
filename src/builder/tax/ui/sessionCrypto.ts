// ============================================================
// Tax Assistant — browser-side at-rest encryption (plan §25)
// ============================================================
// The tax tool runs entirely in the browser (nothing is uploaded),
// so the encrypted "save" can't use the Node-only server crypto.ts.
// This is the browser twin: WebCrypto AES-256-GCM with a key derived
// from the user's passphrase via PBKDF2-SHA256. The saved file is a
// self-describing base64 blob (magic + salt + iv + ciphertext). No
// passphrase ⇒ no decryption, and there is no recovery path — that's
// the privacy guarantee. The format marker is distinct from the
// server file (BTAXW1) because the key-derivation differs (PBKDF2 in
// the browser vs scrypt on the server); the two aren't interchangeable.
// ============================================================

const MAGIC = "BTAXW1";
const PBKDF2_ITERS = 210_000; // OWASP-class PBKDF2-SHA256 work factor
const SALT_BYTES = 16;
const IV_BYTES = 12;

const te = new TextEncoder();
const td = new TextDecoder();

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// WebCrypto wants a BufferSource backed by a plain ArrayBuffer; copy a view's
// bytes into one (sidesteps the TS Uint8Array<ArrayBufferLike> friction).
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", ab(te.encode(passphrase)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ab(salt), iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a JS value → a self-describing base64 string. */
export async function encryptSession(value: unknown, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 8) throw new Error("Passphrase must be at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const plaintext = te.encode(JSON.stringify(value));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(plaintext)));
  const header = te.encode(MAGIC);
  const blob = new Uint8Array(header.length + salt.length + iv.length + ct.length);
  let o = 0;
  blob.set(header, o); o += header.length;
  blob.set(salt, o); o += salt.length;
  blob.set(iv, o); o += iv.length;
  blob.set(ct, o);
  return b64encode(blob);
}

/** Decrypt; a wrong passphrase or any tampering throws (GCM auth tag). */
export async function decryptSession<T = unknown>(blobBase64: string, passphrase: string): Promise<T> {
  let buf: Uint8Array;
  try {
    buf = b64decode(blobBase64.trim());
  } catch {
    throw new Error("That doesn't look like a saved tax file.");
  }
  const magic = td.decode(buf.subarray(0, MAGIC.length));
  if (magic !== MAGIC) throw new Error("Not a recognized tax project file.");
  let o = MAGIC.length;
  const salt = buf.subarray(o, (o += SALT_BYTES));
  const iv = buf.subarray(o, (o += IV_BYTES));
  const ct = buf.subarray(o);
  const key = await deriveKey(passphrase, salt);
  try {
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(ct));
    return JSON.parse(td.decode(dec)) as T;
  } catch {
    throw new Error("Wrong passphrase, or the file is corrupted/tampered with.");
  }
}
