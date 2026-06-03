// ============================================================
// HASH-TOKEN HANDLER (Netlify Identity invite / recovery / confirmation links)
// ============================================================
// When the user clicks an invitation, password-reset, or email-confirmation
// link from Netlify Identity, they land here with a fragment like
//   #invite_token=...
//   #recovery_token=...
//   #confirmation_token=...
//
// The SPA uses state-based routing (no hashes for normal views), but legacy
// shared `#journal/<slug>` links still get rewritten to clean pathnames by
// App.jsx's journal effect. Without this token-aware handler, an Identity
// fragment landing on the home page would:
//   - confuse that journal-hash-rewrite path, and
//   - leave a stray `#...` in the address bar that looks broken.
//
// This handler:
//   1. Detects identity-token hashes BEFORE the SPA router can react.
//   2. Triggers the Netlify Identity widget so it can process the token.
//   3. Clears the hash from the URL once the widget has had a chance to
//      read it.
//
// Runs once per page load, side-effecting only the global Identity widget
// and history state. No application state touched.
(function handleIdentityHashOnce() {
  if (typeof window === 'undefined') return;
  if (window.__netlifyIdentityHashHandled__) return;
  window.__netlifyIdentityHashHandled__ = true;
  const hash = window.location.hash || '';
  if (!hash) return;
  const TOKEN_PATTERNS = /(invite_token|recovery_token|confirmation_token|email_change_token|error_description|access_token)/;
  if (!TOKEN_PATTERNS.test(hash)) return;
  // Open the Identity widget so it can read the hash and act on the token.
  // Retry briefly because the widget script may load slightly after this module.
  const tryOpen = (attempts) => {
    try {
      if (window.netlifyIdentity && typeof window.netlifyIdentity.open === 'function') {
        window.netlifyIdentity.open();
        return;
      }
    } catch {}
    if (attempts < 20) setTimeout(() => tryOpen(attempts + 1), 250);
  };
  tryOpen(0);
  // Clear the hash from the URL after the widget has had time to read it.
  // Without this, the SPA hash router would treat the leftover # as a route.
  setTimeout(() => {
    try {
      history.replaceState(null, '', location.pathname + location.search);
      // Notify any hashchange listeners that the hash is now empty.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch {}
  }, 1500);
})();

// ============================================================
// auth — Netlify Identity wrapper
// ============================================================
// Runs entirely in the browser. Handles signup / signin /
// signout / password reset. Issues a JWT we attach to every
// db.* call.
//
// Components must NOT reach for window.netlifyIdentity directly
// — go through `auth` so error handling, event shape, and
// retries stay consistent.
//
// The widget itself is still loaded from
// `https://identity.netlify.com/v1/netlify-identity-widget.js`
// via a <script> tag in index.html (the Netlify-managed
// confirmation redirect handler expects window.netlifyIdentity
// from that CDN). Do NOT switch to the npm package — they
// behave differently.
//
// ============================================================

function _initAuth() {
  const get = () => {
    if (typeof window === "undefined" || !window.netlifyIdentity) {
      throw new Error("Netlify Identity widget not loaded");
    }
    return window.netlifyIdentity;
  };

  // Internal subscriber list. We notify these from BOTH our own
  // signIn/signUp/signOut wrappers AND the widget's native "login"
  // and "logout" events. Why both: the widget's events fire when
  // the user signs in via the widget's modal UI (e.g. clicking the
  // confirmation link in their email), but they do NOT reliably
  // fire when we call gotrue.login() directly from our custom
  // AuthDrawer form. Having one notification path covers both.
  const subscribers = new Set();
  const notify = (event, session) => {
    for (const cb of subscribers) {
      try { cb(event, session); } catch (err) { console.warn(err); }
    }
  };

  // Initialize once at page load. Idempotent — safe to call again.
  // Also wires the widget's native events into our `notify` channel
  // so anything the widget UI does still propagates to subscribers.
  let initialized = false;
  const init = () => {
    if (initialized) return;
    try {
      const widget = get();
      widget.init();
      widget.on("login",  (u) => notify("SIGNED_IN",  userToSession(u)));
      widget.on("logout", ()  => notify("SIGNED_OUT", null));
      initialized = true;
    } catch (err) {
      console.warn("Identity init failed:", err);
    }
  };

  // Translate the widget's user shape into the same `session.user`
  // shape the old code expected, so call sites can keep using
  // `session.user.id` and `session.user.email`.
  const userToSession = (u) => {
    if (!u) return null;
    return {
      user: {
        id: u.id,
        email: u.email,
        user_metadata: u.user_metadata ?? {},
      },
      token: u.token ?? null,
    };
  };

  // --- AUTH ACTIONS ---
  const signUp = async ({ email, password, fullName, phone }) => {
    init();
    try {
      // gotrue-js (what the widget wraps) signup(): returns user on success.
      // user_metadata is attached so we can hydrate the profile row on first
      // /profile GET. Phone is optional.
      const u = await get().gotrue.signup(email, password, {
        full_name: fullName,
        phone: phone || null,
      });
      // With email confirmation required (the default), gotrue.signup
      // returns a user object but the user is NOT yet logged in. Don't
      // notify SIGNED_IN here; that fires when they confirm + log in.
      return { data: { user: u }, error: null };
    } catch (err) {
      return { data: null, error: { message: err?.message || "Sign up failed" } };
    }
  };

  const signIn = async ({ email, password }) => {
    init();
    try {
      const u = await get().gotrue.login(email, password, true);
      // Manually fire SIGNED_IN so the App's session state updates
      // even if the widget's native "login" event doesn't fire from
      // a direct gotrue.login (it sometimes only fires from the
      // widget's own modal UI).
      notify("SIGNED_IN", userToSession(u));
      return { data: { user: u }, error: null };
    } catch (err) {
      return { data: null, error: { message: err?.message || "Sign in failed" } };
    }
  };

  const signOut = async () => {
    try {
      await get().logout();
      // Belt-and-suspenders: native event SHOULD fire on widget.logout()
      // but emitting our own makes us resilient if it doesn't.
      notify("SIGNED_OUT", null);
      return { error: null };
    } catch (err) {
      return { error: { message: err?.message || "Sign out failed" } };
    }
  };

  // Change the password of the currently-signed-in user. GoTrue's
  // update() endpoint accepts the new password and uses the JWT
  // for authorization (no current-password challenge). The Identity
  // session is valid afterwards — no re-login needed.
  const changePassword = async (newPassword) => {
    init();
    const u = get().currentUser();
    if (!u) return { error: { message: "Not signed in" } };
    try {
      await u.update({ password: newPassword });
      return { error: null };
    } catch (err) {
      return { error: { message: err?.message || "Couldn't update password" } };
    }
  };

  const sendPasswordReset = async (email) => {
    init();
    try {
      await get().gotrue.requestPasswordRecovery(email);
      return { data: { ok: true }, error: null };
    } catch (err) {
      return { data: null, error: { message: err?.message || "Reset failed" } };
    }
  };

  const getSession = async () => {
    init();
    const u = get().currentUser();
    return { session: userToSession(u), error: null };
  };

  // Subscribe to login/logout events. Adapts to the same
  // (event, session) callback the App component already uses.
  const onAuthStateChange = (callback) => {
    init();
    subscribers.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => { subscribers.delete(callback); },
        },
      },
    };
  };

  // Fetch a current, valid JWT. The widget refreshes proactively;
  // we still ask for a fresh token before every authed call so a
  // long-idle tab doesn't fall off the cliff. Returns null when
  // there's no user.
  const getToken = async () => {
    const u = get().currentUser();
    if (!u) return null;
    try {
      // jwt(true) forces a refresh if the token is near expiry.
      return await u.jwt(true);
    } catch (err) {
      console.warn("JWT refresh failed:", err);
      return null;
    }
  };

  // Whether the currently-signed-in user carries the "admin"
  // role on their Identity record. Used to decide whether to
  // render the Admin nav link and admin view. Mirrors the
  // server-side requireAdmin check; the function still enforces
  // independently so a tampered-with browser can't access admin
  // endpoints by lying about the role.
  const isAdmin = () => {
    try {
      const u = get().currentUser();
      const roles = u?.app_metadata?.roles;
      return Array.isArray(roles) && roles.some(function(r){return String(r).toLowerCase()==="admin";});
    } catch { return false; }
  };

  return {
    init, signUp, signIn, signOut, sendPasswordReset, changePassword,
    getSession, onAuthStateChange, getToken, isAdmin,
    // Expose the raw widget for one-off use cases (e.g. opening the
    // social-login modal). Prefer the named methods above.
    raw: () => get(),
  };
}

export const auth = _initAuth();
