// ============================================================
// db — fetch() wrappers around the Netlify Functions
// ============================================================
// Every call automatically includes the current Identity JWT,
// so the Function knows who's asking. If the user is signed
// out, the JWT is omitted and the Function returns 401 —
// callers handle that gracefully.
//
// Components must NOT call fetch() against /.netlify/functions
// directly — add a method here and call db.foo() so error
// shape, auth header, and base path stay consistent.
//
// MIRRORED FROM index.html (~line 3248).
// ============================================================

import { auth } from "./auth.js";
import { CONFIG } from "../data/config.js";

function _initDb() {
  const call = async (path, { method = "GET", body, auth: needAuth = true } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (needAuth) {
      const token = await auth.getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${CONFIG.FN_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      return { error: { message: data?.error || `HTTP ${res.status}` }, data: null };
    }
    return { error: null, data };
  };

  // --- PROFILES ---
  // The Functions identify the user from the Identity JWT, so these
  // wrappers don't need a userId — the leading underscore on the old
  // signature was a hint that the param was already dead.
  const getProfile = async () => {
    const { error, data } = await call("/profile", { method: "GET" });
    return { profile: data?.profile ?? null, error };
  };
  const updateProfile = async (updates) => {
    const { error, data } = await call("/profile", { method: "PUT", body: updates });
    return { profile: data?.profile ?? null, error };
  };

  // Read a File into a base64 string (without the data: prefix). Shared
  // by every blob-upload wrapper below so the FileReader plumbing isn't
  // duplicated per endpoint.
  const fileToBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result?.toString().split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(f);
  });

  // --- AVATAR ---
  // The browser reads the file, base64-encodes it, and posts to the
  // avatar Function. The Function stores it in Netlify Blobs and
  // returns a relative URL the UI can put straight into <img src>.
  const uploadAvatar = async (file) => {
    let dataBase64;
    try { dataBase64 = await fileToBase64(file); }
    catch (err) { return { url: null, error: { message: "Couldn't read file" } }; }

    const { error, data } = await call("/avatar", {
      method: "POST",
      body: { filename: file.name, contentType: file.type, dataBase64 },
    });
    return { url: data?.url ?? null, error };
  };

  // --- ADDRESSES ---
  const listAddresses = async () => {
    const { error, data } = await call("/addresses", { method: "GET" });
    return { addresses: data?.addresses ?? [], error };
  };
  const insertAddress = async (address) => {
    const { error, data } = await call("/addresses", { method: "POST", body: address });
    return { address: data?.address ?? null, error };
  };
  const deleteAddress = async (id) => {
    const { error } = await call(`/addresses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return { error };
  };

  // --- SAVED CART ---
  const getSavedCart = async () => {
    const { error, data } = await call("/saved-cart", { method: "GET" });
    return { cart: data?.cart ?? null, error };
  };
  const saveCart = async (cartData) => {
    const { error } = await call("/saved-cart", { method: "PUT", body: { cart: cartData } });
    return { error };
  };

  // --- ACCOUNT (data export + deletion) ---
  // CCPA/CPRA + GDPR "right to portability" and "right to
  // erasure". The export downloads a JSON file with everything
  // we have about the customer; delete tears the account down
  // and removes the Identity user. Past orders are preserved
  // anonymized (user_id nulled) for tax retention.
  const exportAccountData = async () => {
    const token = await auth.getToken();
    if (!token) return { blob: null, error: { message: "Not signed in" } };
    try {
      const res = await fetch(`${CONFIG.FN_BASE}/account-export`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { blob: null, error: { message: body?.error || `HTTP ${res.status}` } };
      }
      const blob = await res.blob();
      return { blob, error: null };
    } catch (err) {
      return { blob: null, error: { message: err?.message || "Network error" } };
    }
  };
  const deleteAccount = async (confirm) => {
    const { error } = await call("/account-delete", { method: "POST", body: { confirm } });
    return { error };
  };

  // --- ADMIN ---
  // Lusik-only endpoints. These will 403 for any non-admin user
  // even if they reach the wrapper, but the UI gates them too.
  const adminListOrders = async () => {
    const { error, data } = await call("/admin-orders", { method: "GET" });
    return { orders: data?.orders ?? [], error };
  };
  const adminGetOrder = async (id) => {
    const { error, data } = await call(`/admin-orders?id=${encodeURIComponent(id)}`, { method: "GET" });
    return { order: data?.order ?? null, error };
  };
  const adminUpdateOrder = async (id, updates) => {
    const { error, data } = await call(`/admin-orders?id=${encodeURIComponent(id)}`, { method: "PUT", body: updates });
    return { order: data?.order ?? null, error };
  };
  const adminUploadOrderPhoto = async (orderId, file) => {
    let dataBase64;
    try { dataBase64 = await fileToBase64(file); }
    catch { return { url: null, key: null, error: { message: "Couldn't read file" } }; }
    const { error, data } = await call("/admin-order-photo", {
      method: "POST",
      body: { orderId, filename: file.name, contentType: file.type, dataBase64 },
    });
    return { url: data?.url ?? null, key: data?.key ?? null, error };
  };

  // --- ADMIN WAITLIST ---
  const adminListWaitlists = async () => {
    const { error, data } = await call("/admin-waitlist", { method: "GET" });
    return { items: data?.items ?? [], error };
  };
  const adminNotifyWaitlist = async ({ product_key, product_name, product_url }) => {
    const { error, data } = await call("/admin-waitlist-notify", {
      method: "POST",
      body: { product_key, product_name, product_url },
    });
    return { sent: data?.sent ?? 0, failed: data?.failed ?? 0, remaining: data?.remaining ?? 0, error };
  };

  // --- SAVED DESIGNS ---
  // Customer-side "my designs" library. Each entry is the
  // compact picker state plus a label and timestamp.
  const listSavedDesigns = async () => {
    const { error, data } = await call("/saved-designs", { method: "GET" });
    return { designs: data?.designs ?? [], error };
  };
  const saveDesign = async (entry) => {
    const { error, data } = await call("/saved-designs", { method: "POST", body: entry });
    return { design: data?.design ?? null, error };
  };
  const deleteSavedDesign = async (id) => {
    const { error } = await call(`/saved-designs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return { error };
  };

  // --- ORDERS ---
  const listOrders = async () => {
    const { error, data } = await call("/orders", { method: "GET" });
    return { orders: data?.orders ?? [], error };
  };
  const linkGuestOrders = async () => {
    const { error, data } = await call("/link-guest-order", { method: "POST", body: {} });
    return { linkedCount: data?.linkedCount ?? 0, error };
  };

  return {
    getProfile, updateProfile, uploadAvatar,
    listAddresses, insertAddress, deleteAddress,
    getSavedCart, saveCart,
    listOrders, linkGuestOrders,
    listSavedDesigns, saveDesign, deleteSavedDesign,
    adminListOrders, adminGetOrder, adminUpdateOrder, adminUploadOrderPhoto,
    adminListWaitlists, adminNotifyWaitlist,
    exportAccountData, deleteAccount,
  };
}

export const db = _initDb();
