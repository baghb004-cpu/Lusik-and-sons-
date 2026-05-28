// ============================================================
// AccountView — signed-in customer's dashboard
// ============================================================
// Profile (name, phone, avatar), order history, saved
// designs, address book, sign-out, account export, account
// delete. Big component but composed of OrderHistory +
// SavedDesignsSection + inline-form profile editor.
//
// MIRRORED FROM index.html (~line 7045).
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { CONFIG } from "../data/config.js";
import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { OrderHistory } from "./OrderHistory.jsx";
import { SavedDesignsSection } from "./SavedDesignsSection.jsx";
import { useToast } from "./ToastProvider.jsx";
import { Camera, ChevronLeft, Eye, EyeOff, LogOut, User } from "./icons.jsx";

export function AccountView({ user, profile, onProfileUpdate, onBack, onSignOut, onReorder, product, onOpenAdmin, inSheet = false }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);
  // Inline messages are kept ONLY for input-validation feedback that
  // belongs next to the form field (e.g. "image is too large"). All
  // post-network success / failure feedback flows through toasts —
  // see calls to `toast({...})` below.
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });

  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef(null);

  // --- CHANGE PASSWORD ---
  // Inline expandable form below the profile section. Validates
  // min-8-chars and matching confirm field before submit
  // enables. GoTrue's update endpoint uses the existing JWT, so
  // no re-auth needed afterwards.
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [pwdBusy, setPwdBusy]       = useState(false);
  const handleChangePassword = async () => {
    if (newPwd.length < 8 || newPwd !== confirmPwd) return;
    setPwdBusy(true);
    const { error } = await auth.changePassword(newPwd);
    setPwdBusy(false);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't update password — please try again." });
      return;
    }
    setChangingPassword(false);
    setNewPwd("");
    setConfirmPwd("");
    setShowPwd(false);
    toast({ kind: "success", message: "Password updated." });
  };

  // --- ACCOUNT DATA / DELETION ---
  // Self-serve CCPA/CPRA. Export downloads a JSON file with
  // everything we hold; delete asks the customer to type
  // "DELETE" in a modal before tearing the account down.
  const [exportBusy, setExportBusy]   = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy]   = useState(false);

  const handleExportData = async () => {
    setExportBusy(true);
    const { blob, error } = await db.exportAccountData();
    setExportBusy(false);
    if (error || !blob) {
      toast({ kind: "error", message: error?.message || "Couldn't export — please try again." });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url;
    a.download = `lusikandsons-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ kind: "success", message: "Your data has been downloaded." });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleteBusy(true);
    const { error } = await db.deleteAccount("DELETE");
    if (error) {
      setDeleteBusy(false);
      toast({ kind: "error", message: error.message || "Couldn't delete your account — please try again or email hello@lusikandsons.com." });
      return;
    }
    // Hard reload to /?account=deleted. App.useEffect catches
    // the query param + toasts. The reload also clears any
    // stale in-memory Identity state since the user is gone.
    window.location.assign("/?account=deleted");
  };

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({
    label: "Home", recipient_name: "", street_line_1: "", street_line_2: "",
    city: "", state: "", postal_code: "", country: "US", phone: "",
  });

  // If profile prop changes (e.g. from auth state refresh), sync the form fields.
  useEffect(() => {
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
  }, [profile?.id]);

  // Load addresses on mount
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    db.listAddresses().then(({ addresses: a, error }) => {
      if (!mounted) return;
      if (error) console.warn("listAddresses error:", error);
      setAddresses(a || []);
      setAddressesLoading(false);
    });
    return () => { mounted = false; };
  }, [user?.id]);

  const saveProfile = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    setProfileMsg({ type: "", text: "" });
    const { profile: updated, error } = await db.updateProfile({
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
    });
    setSavingProfile(false);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't save changes — please try again." });
      return;
    }
    onProfileUpdate(updated);
    setEditing(false);
    toast({ kind: "success", message: "Profile saved." });
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileMsg({ type: "", text: "" });
    // Local validation stays inline — the error sits right next to the
    // avatar control so the customer immediately sees what's wrong.
    if (!CONFIG.AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      setProfileMsg({ type: "error", text: "Please choose a PNG, JPEG, or WebP image." });
      return;
    }
    if (file.size > CONFIG.AVATAR_MAX_BYTES) {
      setProfileMsg({ type: "error", text: `Image is too large (max ${(CONFIG.AVATAR_MAX_BYTES / 1024 / 1024).toFixed(0)} MB).` });
      return;
    }
    setAvatarBusy(true);
    const { url, error } = await db.uploadAvatar(file);
    if (error || !url) {
      setAvatarBusy(false);
      toast({ kind: "error", message: error?.message || "Couldn't upload that photo — please try again." });
      return;
    }
    const { profile: updated, error: updErr } = await db.updateProfile({ avatar_url: url });
    setAvatarBusy(false);
    if (updErr) {
      toast({ kind: "error", message: "Photo uploaded but we couldn't save it to your profile — please try again." });
      return;
    }
    onProfileUpdate(updated);
    toast({ kind: "success", message: "Profile photo updated." });
  };

  const submitAddress = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    const required = ["recipient_name", "street_line_1", "city", "state", "postal_code"];
    for (const k of required) {
      if (!newAddr[k]?.trim()) return; // HTML required attribute will catch this
    }
    const { address, error } = await db.insertAddress(newAddr);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't save that address — please try again." });
      return;
    }
    setAddresses((a) => [address, ...a]);
    setAddingAddress(false);
    setNewAddr({
      label: "Home", recipient_name: "", street_line_1: "", street_line_2: "",
      city: "", state: "", postal_code: "", country: "US", phone: "",
    });
    toast({ kind: "success", message: "Address saved." });
  };

  const removeAddress = async (id) => {
    const { error } = await db.deleteAddress(id);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't remove that address — please try again." });
      return;
    }
    setAddresses((a) => a.filter((x) => x.id !== id));
    toast({ kind: "info", message: "Address removed." });
  };

  const inputCls = "w-full px-4 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)]";
  const inputStyle = { border: "1px solid rgba(26,22,18,0.15)" };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 lg:px-12 py-20 text-center">
        <p className="opacity-70">Please sign in to view your account.</p>
      </div>
    );
  }

  return (
    <div className={`fade-in max-w-4xl mx-auto ${inSheet ? "px-6 pt-2 pb-8" : "px-6 lg:px-12 py-12 lg:py-20"}`}>
      {/* Page header. In the mobile bottom-sheet the X button + grabber +
          swipe-down already provide "close", so the in-page back link is
          hidden there. */}
      {!inSheet && (
        <button onClick={onBack} className="text-xs tracking-[0.2em] uppercase opacity-60 hover:opacity-100 flex items-center gap-2 mb-8">
          <ChevronLeft size={14} /> Back to shop
        </button>
      )}

      <div className={inSheet ? "mb-8" : "mb-12"}>
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>My Account</p>
        <h1 className="font-display text-4xl lg:text-5xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
          Welcome{profile?.full_name ? <>, <em style={{ fontWeight: 400 }}>{profile.full_name.split(" ")[0]}</em></> : ""}.
        </h1>
      </div>

      <div className="gold-line mb-12" />

      {/* PROFILE SECTION */}
      <section className="mb-16">
        <h2 className="text-xs tracking-[0.3em] uppercase mb-6 opacity-70">Your profile</h2>

        <div className="flex items-start gap-6 mb-6">
          {/* Avatar */}
          <div className="relative">
            <div
              className="w-24 h-24 lg:w-28 lg:h-28 overflow-hidden flex items-center justify-center"
              style={{ background: "rgba(176,136,66,0.1)", border: "1px solid rgba(26,22,18,0.15)", borderRadius: "50%" }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <User size={32} strokeWidth={1.25} style={{ color: "#B08842" }} />
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarBusy}
              className="absolute -bottom-1 -right-1 w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: "var(--ink)", color: "var(--text-on-ink)", border: "2px solid var(--bg-page)" }}
              aria-label="Change profile photo"
              data-tooltip="Change photo"
              data-tooltip-pos="top"
            >
              <Camera size={14} strokeWidth={1.5} />
            </button>
            <input
              ref={avatarInputRef}
              type="file" accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatar}
              className="hidden"
            />
          </div>

          <div className="flex-1 pt-2">
            <p className="font-display text-xl" style={{ fontWeight: 500 }}>
              {profile?.full_name || <span className="opacity-50">Add your name</span>}
            </p>
            <p className="text-sm opacity-70 mt-1">{user.email}</p>
            {profile?.phone && <p className="text-sm opacity-70 mt-0.5">{profile.phone}</p>}
            {avatarBusy && <p className="text-xs opacity-60 mt-2 italic">Uploading photo…</p>}
          </div>
        </div>

        {/* Edit form / view mode */}
        {editing ? (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-xs tracking-[0.2em] uppercase opacity-70 block mb-1.5">Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs tracking-[0.2em] uppercase opacity-70 block mb-1.5">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={inputCls} style={inputStyle} />
            </div>
            <div className="flex gap-3">
              <button onClick={saveProfile} disabled={savingProfile} className="px-5 py-2 text-xs tracking-[0.2em] uppercase" style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}>
                {savingProfile ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditing(false); setFullName(profile?.full_name || ""); setPhone(profile?.phone || ""); }} className="px-5 py-2 text-xs tracking-[0.2em] uppercase" style={{ border: "1px solid rgba(26,22,18,0.2)" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={() => setEditing(true)} className="text-xs tracking-[0.2em] uppercase underline opacity-70 hover:opacity-100">
              Edit profile
            </button>
            <span className="opacity-30">·</span>
            <button onClick={() => setChangingPassword(true)} className="text-xs tracking-[0.2em] uppercase underline opacity-70 hover:opacity-100">
              Change password
            </button>
          </div>
        )}

        {/* CHANGE PASSWORD FORM — only renders when the customer
            taps "Change password" above. Validates min 8 chars +
            both-fields-match before enabling the submit button.
            On success, the form collapses and a toast confirms. */}
        {changingPassword && (
          <div className="mt-6 p-4 max-w-md" style={{ background: "rgba(176,136,66,0.06)", border: "1px solid rgba(176,136,66,0.2)" }}>
            <p className="text-[0.65rem] tracking-[0.25em] uppercase mb-3" style={{ color: "#B08842", fontWeight: 600 }}>Change password</p>
            <div className="space-y-3">
              <div>
                <label className="text-[0.6rem] tracking-[0.2em] uppercase opacity-70 block mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className={inputCls}
                    style={{ ...inputStyle, paddingRight: "2.5rem" }}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-90"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[0.6rem] tracking-[0.2em] uppercase opacity-70 block mb-1.5">Confirm new password</label>
                <input
                  type={showPwd ? "text" : "password"}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  autoComplete="new-password"
                />
                {newPwd && confirmPwd && newPwd !== confirmPwd && (
                  <p className="text-[0.65rem] mt-1.5" style={{ color: "#8B2C2C" }}>Passwords don't match.</p>
                )}
                {newPwd && newPwd.length < 8 && (
                  <p className="text-[0.65rem] mt-1.5 opacity-65">At least 8 characters.</p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleChangePassword}
                  disabled={pwdBusy || newPwd.length < 8 || newPwd !== confirmPwd}
                  className="px-5 py-2 text-xs tracking-[0.2em] uppercase"
                  style={{
                    background: (pwdBusy || newPwd.length < 8 || newPwd !== confirmPwd) ? "rgba(26,22,18,0.35)" : "#1A1612",
                    color: "#F5EFE3",
                    fontWeight: 500,
                    cursor: (pwdBusy || newPwd.length < 8 || newPwd !== confirmPwd) ? "not-allowed" : "pointer",
                  }}
                >
                  {pwdBusy ? "Updating…" : "Update password"}
                </button>
                <button
                  onClick={() => { setChangingPassword(false); setNewPwd(""); setConfirmPwd(""); setShowPwd(false); }}
                  disabled={pwdBusy}
                  className="px-5 py-2 text-xs tracking-[0.2em] uppercase"
                  style={{ border: "1px solid rgba(26,22,18,0.2)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {profileMsg.text && (
          <p className={`text-sm mt-4 ${profileMsg.type === "error" ? "" : "opacity-70"}`} style={{ color: profileMsg.type === "error" ? "#8B2C2C" : "#1A1612" }}>
            {profileMsg.text}
          </p>
        )}
      </section>

      <div className="gold-line mb-12" />

      {/* ADDRESSES SECTION */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs tracking-[0.3em] uppercase opacity-70">Saved addresses</h2>
          {!addingAddress && (
            <button onClick={() => setAddingAddress(true)} className="text-xs tracking-[0.2em] uppercase underline opacity-70 hover:opacity-100">
              + Add address
            </button>
          )}
        </div>

        {addressesLoading ? (
          <p className="text-sm opacity-60">Loading…</p>
        ) : addresses.length === 0 && !addingAddress ? (
          <p className="text-sm opacity-60 italic">No saved addresses yet. We'll never need one until you place an order.</p>
        ) : (
          <div className="space-y-3">
            {addresses.map((a) => (
              <div key={a.id} className="p-4 flex items-start justify-between gap-4" style={{ border: "1px solid rgba(26,22,18,0.12)" }}>
                <div className="flex-1">
                  {a.label && <p className="text-[0.6rem] tracking-[0.3em] uppercase opacity-60 mb-1">{a.label}</p>}
                  <p className="font-display text-base" style={{ fontWeight: 500 }}>{a.recipient_name}</p>
                  <p className="text-sm opacity-70 leading-relaxed">
                    {a.street_line_1}
                    {a.street_line_2 && <>, {a.street_line_2}</>}<br />
                    {a.city}, {a.state} {a.postal_code}<br />
                    {a.country}
                    {a.phone && <><br />{a.phone}</>}
                  </p>
                </div>
                <button onClick={() => removeAddress(a.id)} className="text-xs underline opacity-50 hover:opacity-100">Remove</button>
              </div>
            ))}
          </div>
        )}

        {addingAddress && (
          <form onSubmit={submitAddress} className="mt-6 p-5 space-y-4" style={{ border: "1px solid rgba(176,136,66,0.4)", background: "rgba(176,136,66,0.04)" }}>
            <p className="text-xs tracking-[0.3em] uppercase opacity-70">New address</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs opacity-70 block mb-1">Label</label>
                <input value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} className={inputCls} style={inputStyle} placeholder="Home" />
              </div>
              <div>
                <label className="text-xs opacity-70 block mb-1">Recipient name *</label>
                <input value={newAddr.recipient_name} onChange={(e) => setNewAddr({ ...newAddr, recipient_name: e.target.value })} required className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="text-xs opacity-70 block mb-1">Street address *</label>
              <input value={newAddr.street_line_1} onChange={(e) => setNewAddr({ ...newAddr, street_line_1: e.target.value })} required className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs opacity-70 block mb-1">Apartment, suite, etc.</label>
              <input value={newAddr.street_line_2} onChange={(e) => setNewAddr({ ...newAddr, street_line_2: e.target.value })} className={inputCls} style={inputStyle} />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs opacity-70 block mb-1">City *</label>
                <input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} required className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="text-xs opacity-70 block mb-1">State *</label>
                <input value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value.toUpperCase().slice(0, 2) })} required maxLength={2} className={inputCls} style={inputStyle} placeholder="CA" />
              </div>
              <div>
                <label className="text-xs opacity-70 block mb-1">ZIP *</label>
                <input value={newAddr.postal_code} onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })} required className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-5 py-2 text-xs tracking-[0.2em] uppercase" style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}>Save address</button>
              <button type="button" onClick={() => setAddingAddress(false)} className="px-5 py-2 text-xs tracking-[0.2em] uppercase" style={{ border: "1px solid rgba(26,22,18,0.2)" }}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      <div className="gold-line mb-12" />

      {/* SAVED DESIGNS */}
      <section className="mb-16">
        <h2 className="text-xs tracking-[0.3em] uppercase mb-6 opacity-70">Saved designs</h2>
        <SavedDesignsSection userId={user.id} product={product} />
      </section>

      <div className="gold-line mb-12" />

      {/* ORDER HISTORY */}
      <section className="mb-16">
        <h2 className="text-xs tracking-[0.3em] uppercase mb-6 opacity-70">Order history</h2>
        <OrderHistory userId={user.id} onReorder={onReorder} />
      </section>

      <div className="gold-line mb-12" />

      {/* SIGN OUT + ADMIN — bottom of the page so it doesn't compete
          with the customer's normal account actions. Admin link is
          rendered only when the Identity user has the role. */}
      <div className="flex items-center justify-between gap-6 flex-wrap mb-16">
        <button
          onClick={onSignOut}
          className="text-xs tracking-[0.2em] uppercase opacity-60 hover:opacity-100 flex items-center gap-2"
        >
          <LogOut size={14} strokeWidth={1.5} /> Sign out
        </button>
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="text-xs tracking-[0.2em] uppercase flex items-center gap-2 transition"
            style={{ color: "#B08842", fontWeight: 500 }}
          >
            Open admin panel →
          </button>
        )}
      </div>

      {/* YOUR DATA — CCPA/CPRA self-serve actions. Visually
          quiet (small monospace-feeling type, no headings
          competing with the rest of the page) but actually
          present, which is a real differentiator from template
          sites that bury these rights in fine print. */}
      <section className="pt-10" style={{ borderTop: "1px solid rgba(26,22,18,0.1)" }}>
        <h2 className="text-xs tracking-[0.3em] uppercase mb-3 opacity-50">Your data</h2>
        <p className="text-xs opacity-65 leading-relaxed mb-5 max-w-md">
          You can download everything we have about you, or delete your account entirely. Past orders are kept anonymized for tax records (we have to) but your name, address, saved designs, and account are removed.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportData}
            disabled={exportBusy}
            className="px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition hover:opacity-80 disabled:opacity-40"
            style={{ border: "1px solid rgba(26,22,18,0.2)", color: "#1A1612", fontWeight: 500 }}
          >
            {exportBusy ? "Preparing…" : "↓ Download my data"}
          </button>
          <button
            onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}
            className="px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition hover:bg-[rgba(139,44,44,0.06)]"
            style={{ border: "1px solid rgba(139,44,44,0.4)", color: "#8B2C2C", fontWeight: 500 }}
          >
            Delete my account
          </button>
        </div>
      </section>

      {/* DELETE-CONFIRMATION MODAL. Inline, not extracted, so it
          stays close to its triggering button + state. Type
          "DELETE" to enable the delete button — a basic
          confirmation gate that mirrors the server-side
          requirement. */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => !deleteBusy && setDeleteOpen(false)} role="dialog" aria-modal="true" aria-label="Confirm account deletion">
          <div className="absolute inset-0" style={{ background: "rgba(26,22,18,0.55)" }} />
          <div className="relative w-full max-w-md fade-in p-6 lg:p-8" style={{ background: "var(--bg-page)", border: "1px solid var(--border-strong)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: "#8B2C2C", fontWeight: 600 }}>This can't be undone</p>
            <h3 className="font-display text-2xl lg:text-3xl mb-4" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              Delete your account?
            </h3>
            <div className="text-sm opacity-80 leading-relaxed mb-5 space-y-3">
              <p><strong>Removed:</strong> your profile, saved addresses, saved designs, avatar, saved cart, and your Identity sign-in. You won't be able to sign in again with this email.</p>
              <p><strong>Kept:</strong> past orders, anonymized — they're kept for tax purposes, but your name and the user-account link are removed. Lusik's internal notes about past orders aren't auto-scrubbed; email hello@lusikandsons.com if you'd like those too.</p>
            </div>
            <label className="block mb-1.5">
              <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70">Type <span style={{ fontFamily: "monospace", letterSpacing: 0, color: "#8B2C2C", fontWeight: 600 }}>DELETE</span> to confirm</span>
            </label>
            <input
              type="text"
              value={deleteConfirm}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoFocus
              disabled={deleteBusy}
              className="w-full px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(139,44,44,0.3)] mb-5"
              style={{ border: "1px solid rgba(26,22,18,0.2)", fontFamily: "monospace", letterSpacing: "0.1em" }}
              aria-label="Confirmation phrase"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleteBusy}
                className="px-4 py-2 text-[0.65rem] tracking-[0.2em] uppercase opacity-70 hover:opacity-100 transition"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "DELETE" || deleteBusy}
                className="px-5 py-2.5 text-[0.65rem] tracking-[0.2em] uppercase transition"
                style={{
                  background: (deleteConfirm !== "DELETE" || deleteBusy) ? "rgba(139,44,44,0.35)" : "#8B2C2C",
                  color: "#F5EFE3",
                  fontWeight: 500,
                  cursor: (deleteConfirm !== "DELETE" || deleteBusy) ? "not-allowed" : "pointer",
                }}
              >
                {deleteBusy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
