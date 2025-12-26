// shared.js — ExposureShield (Email check uses live /api/check-email)
// NOTE: This file runs in the browser. Do NOT use process.env here.

(function () {
  "use strict";

  const API_ENDPOINT = "/api/check-email";
  const TIMEOUT_MS = 15000;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = String(s ?? "");
    return div.innerHTML;
  }

  function withTimeout(promise, ms) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    const wrapped = (async () => {
      try {
        return await promise(controller.signal);
      } finally {
        clearTimeout(t);
      }
    })();
    return wrapped;
  }

  function riskLabel(count) {
    if (count >= 8) return { label: "High", color: "#fb7185", bg: "rgba(251,113,133,0.10)", border: "rgba(251,113,133,0.30)" };
    if (count >= 3) return { label: "Medium", color: "#fbbf24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.30)" };
    return { label: "Low", color: "#34d399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.30)" };
  }

  function renderBreaches(email, breaches) {
    const hibpResult = $("hibpResult");
    if (!hibpResult) return;

    const list = Array.isArray(breaches) ? breaches : [];
    const count = list.length;
    const risk = riskLabel(count);

    if (count === 0) {
      hibpResult.innerHTML = `
        <div style="margin-bottom:10px;">
          <b style="color:#34d399;">Good news:</b>
          No breaches found for <b>${escapeHtml(email)}</b>.
        </div>
        <div class="tag" style="display:inline-flex; padding:6px 10px; border-radius:999px; border:1px solid ${risk.border}; background:${risk.bg}; color:${risk.color}; font-weight:800;">
          Risk Level: ${risk.label}
        </div>
        <div class="hint" style="margin-top:12px; opacity:.75;">Secure check powered by Have I Been Pwned</div>
      `;
      return;
    }

    // Sort newest first (BreachDate is ISO yyyy-mm-dd)
    const sorted = [...list].sort((a, b) => {
      const da = new Date(a?.BreachDate || 0).getTime();
      const db = new Date(b?.BreachDate || 0).getTime();
      return db - da;
    });

    // Render all breaches (or cap if you want)
    const itemsHtml = sorted.map((b) => {
      const title = escapeHtml(b?.Title || b?.Name || "Unknown breach");
      const date = escapeHtml(b?.BreachDate || "Unknown date");
      const domain = escapeHtml(b?.Domain || "");
      const dataClasses = Array.isArray(b?.DataClasses) ? b.DataClasses.slice(0, 4).map(escapeHtml).join(", ") : "";
      const detailLink = b?.Name ? `https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b.Name)}` : null;

      return `
        <div style="margin:10px 0; padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div>
              <div style="font-weight:800; color:rgba(255,255,255,0.92);">${title}</div>
              <div style="margin-top:4px; font-size:12px; color:rgba(255,255,255,0.70);">
                ${domain ? `${domain} • ` : ""}${date}${dataClasses ? ` • ${dataClasses}` : ""}
              </div>
            </div>
            ${detailLink ? `<a class="btn" style="padding:8px 10px; font-size:12px;" href="${detailLink}" target="_blank" rel="noreferrer">Details</a>` : ""}
          </div>
        </div>
      `;
    }).join("");

    hibpResult.innerHTML = `
      <div style="margin-bottom:10px;">
        <b style="color:#fb7185;">Security Alert</b><br/>
        Your email <b>${escapeHtml(email)}</b> was found in <b>${count}</b> breach${count !== 1 ? "es" : ""}.
      </div>

      <div class="tag" style="display:inline-flex; margin-bottom:12px; padding:6px 10px; border-radius:999px; border:1px solid ${risk.border}; background:${risk.bg}; color:${risk.color}; font-weight:800;">
        Risk Level: ${risk.label}
      </div>

      ${itemsHtml}

      <div style="margin-top:14px; color:rgba(255,255,255,0.75);">
        <b>Recommended Actions:</b>
        <ul style="margin:6px 0 0; padding-left:18px;">
          <li>Change passwords for affected accounts</li>
          <li>Enable two-factor authentication (2FA)</li>
          <li>Use a password manager</li>
          <li>Monitor accounts for suspicious activity</li>
        </ul>
      </div>

      <div class="hint" style="margin-top:12px; opacity:.75;">Secure check powered by Have I Been Pwned</div>
    `;
  }

  async function fetchBreaches(email) {
    const url = `${API_ENDPOINT}?email=${encodeURIComponent(email)}`;

    return await withTimeout(async (signal) => {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal
      });

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const data = ct.includes("application/json") ? await res.json().catch(() => null) : null;

      if (!res.ok) {
        const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `API error: ${res.status}`;
        const detail = data && data.detail ? `\n${data.detail}` : "";
        throw new Error(msg + detail);
      }

      return data || { ok: true, breaches: [] };
    }, TIMEOUT_MS);
  }

  function wireEmailCheck() {
    const hibpForm = $("hibpForm");
    const hibpEmail = $("hibpEmail");
    const hibpResult = $("hibpResult");

    if (!hibpForm || !hibpEmail || !hibpResult) return;

    hibpForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = (hibpEmail.value || "").trim();
      if (!email || !email.includes("@")) {
        hibpResult.innerHTML = `<div style="color:#fb7185;">Please enter a valid email address.</div>`;
        return;
      }

      hibpResult.innerHTML = `<div style="color:#38bdf8;">Checking ${escapeHtml(email)}…</div>`;

      try {
        const result = await fetchBreaches(email);
        const breaches = Array.isArray(result?.breaches) ? result.breaches : [];
        renderBreaches(email, breaches);

        // OPTIONAL: show premium section after results (if present)
        const premium = $("premiumReport");
        if (premium) premium.style.display = "block";

        const reportEmail = $("reportEmail");
        if (reportEmail) reportEmail.textContent = email;
      } catch (err) {
        hibpResult.innerHTML = `<div style="color:#fb7185;">${escapeHtml(err?.message || err)}</div>`;
      }
    });

    hibpForm.addEventListener("reset", () => {
      hibpResult.innerHTML = "Enter email above to check for breaches.";
      const premium = $("premiumReport");
      if (premium) premium.style.display = "none";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const yearEl = $("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    wireEmailCheck();
  });
})();
