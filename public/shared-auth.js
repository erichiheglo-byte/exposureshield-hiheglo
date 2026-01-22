/* public/shared-auth.js
   Shared auth helper used by login/register/dashboard pages.
*/
(function () {
  "use strict";

  // ---------- Small helpers ----------
  function qs(id) {
    return document.getElementById(id);
  }

  function getEmailValue() {
    // Try common ids used across pages
    const el =
      qs("email") ||
      qs("loginEmail") ||
      qs("hibpEmail") ||
      document.querySelector('input[type="email"]');
    return (el && el.value ? String(el.value) : "").trim();
  }

  function getToken() {
    return localStorage.getItem("ES_TOKEN") || "";
  }

  function setToken(token) {
    localStorage.setItem("ES_TOKEN", token);
  }

  function clearToken() {
    localStorage.removeItem("ES_TOKEN");
  }

  async function apiFetch(path, opts = {}) {
    const token = getToken();

    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {}
    );

    // If your backend expects Authorization header
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,

      // If your backend uses httpOnly cookies instead of bearer token,
      // keep this enabled. Safe even if unused.
      credentials: "include",
    });

    // Try to parse JSON safely
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => null);
    }

    return { ok: res.ok, status: res.status, data };
  }

  // ---------- Public API ----------
  window.ExposureShieldAuth = {
    getEmailValue,
    getToken,
    setToken,
    clearToken,
    apiFetch,

    async requireAuthOrRedirect(redirectTo = "/login") {
      const token = getToken();

      // If you rely on cookie-only auth, remove this token check
      // and only validate via /api/user/profile.
      if (!token) {
        window.location.href = redirectTo;
        return false;
      }

      const r = await apiFetch("/api/user/profile");
      if (!r.ok) {
        clearToken();
        window.location.href = redirectTo;
        return false;
      }
      return true;
    },
  };

  console.log("✅ shared-auth.js loaded (ExposureShieldAuth ready)");
})();
