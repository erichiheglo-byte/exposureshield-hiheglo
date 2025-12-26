// shared.js (ExposureShield - clean production)
// - No process.env in browser
// - Uses /api/check-email
// - Shows premium upgrade after results
// - Unlocks PDF download after "payment unlock" (simple token in localStorage)

(function () {
  "use strict";

  const CONFIG = {
    EMAIL_CHECK_ENDPOINT: "/api/check-email",
    PDF_PRICE_LABEL: "$4.99",
    PAYMENT_UNLOCK_KEY: "exposureshield_paid_email", // value = email that is paid
    PAYPAL_LINK: "https://www.paypal.com/ncp/payment/SHY4ALC2YJ5VU",
    REQUEST_TIMEOUT_MS: 15000,
  };

  const state = {
    currentEmail: "",
    currentBreaches: [],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = String(s ?? "");
    return div.innerHTML;
  }

  function setStatus(msg) {
    const el = $("paymentStatus");
    if (!el) return;
    el.style.display = "block";
    el.innerHTML = msg;
  }

  function hideStatus() {
    const el = $("paymentStatus");
    if (!el) return;
    el.style.display = "none";
    el.innerHTML = "";
  }

  function showPremium() {
    const box = $("premiumReport");
    if (box) box.style.display = "block";
  }

  function hidePremium() {
    const box = $("premiumReport");
    if (box) box.style.display = "none";
  }

  function showDownload(email) {
    const d = $("downloadSection");
    const e = $("reportEmail");
    const paypal = $("paypalContainer");

    if (e) e.textContent = email || "";
    if (d) d.style.display = "block";
    if (paypal) paypal.style.display = "none";
  }

  function hideDownload() {
    const d = $("downloadSection");
    const paypal = $("paypalContainer");
    if (d) d.style.display = "none";
    if (paypal) paypal.style.display = "block";
  }

  function isPaidForEmail(email) {
    const paidEmail = (localStorage.getItem(CONFIG.PAYMENT_UNLOCK_KEY) || "").trim().toLowerCase();
    return paidEmail && email && paidEmail === email.trim().toLowerCase();
  }

  function markPaidForEmail(email) {
    localStorage.setItem(CONFIG.PAYMENT_UNLOCK_KEY, (email || "").trim().toLowerCase());
  }

  async function fetchJsonWithTimeout(url, ms) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);

    try {
      const r = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await r.json().catch(() => null);
      return { r, data };
    } finally {
      clearTimeout(t);
    }
  }

  function renderResults(email, breaches) {
    const out = $("hibpResult");
    if (!out) return;

    const count = Array.isArray(breaches) ? breaches.length : 0;

    if (count === 0) {
      out.innerHTML = `
        <b style="color: rgba(52,211,153,0.95);">Good news:</b>
        No breaches found for <b>${escapeHtml(email)}</b>.
        <div class="hint" style="margin-top:8px;">Powered by Have I Been Pwned</div>
      `;
      return;
    }

    const risk = count >= 8 ? "High" : count >= 3 ? "Medium" : "Low";

    const list = breaches.slice(0, 5).map(b => {
      const title = escapeHtml(b?.Title || b?.Name || "Unknown breach");
      const domain = escapeHtml(b?.Domain || "Unknown domain");
      const date = escapeHtml(b?.BreachDate || "Unknown date");
      return `
        <div style="margin:10px 0; padding:12px; border:1px solid rgba(255,255,255,0.08); border-radius:10px; background: rgba(255,255,255,0.03);">
          <div style="font-weight:800;">${title}</div>
          <div style="color: rgba(255,255,255,0.72); font-size: 13px; margin-top:4px;">${domain} • ${date}</div>
        </div>
      `;
    }).join("");

    out.innerHTML = `
      <div style="margin-bottom:10px;">
        <b style="color: rgba(251,113,133,0.95);">Security Alert</b><br/>
        Your email <b>${escapeHtml(email)}</b> was found in <b>${count}</b> breach${count !== 1 ? "es" : ""}.
      </div>

      <div class="tag" style="margin-bottom: 10px; border-color: rgba(251,113,133,0.35); background: rgba(251,113,133,0.10); color: rgba(255,255,255,0.90);">
        Risk Level: ${risk}
      </div>

      ${list}

      <div style="margin-top:12px; color: rgba(255,255,255,0.72); font-size: 14px;">
        <b>Recommended Actions:</b>
        <ul style="margin:8px 0 0; padding-left: 18px;">
          <li>Change passwords for affected accounts</li>
          <li>Enable two-factor authentication (2FA)</li>
          <li>Use a password manager</li>
          <li>Monitor accounts for suspicious activity</li>
        </ul>
      </div>

      <div class="hint" style="margin-top:12px;">Secure check powered by Have I Been Pwned</div>
    `;
  }

  function buildPayPalUI() {
    const container = $("paypalContainer");
    if (!container) return;

    container.innerHTML = `
      <div style="margin-top:12px; padding:14px; border:1px solid rgba(255,255,255,0.08); border-radius:14px; background: rgba(255,255,255,0.03);">
        <div style="font-weight:900; font-size:16px; margin-bottom:6px;">Unlock PDF Report (${CONFIG.PDF_PRICE_LABEL})</div>
        <div style="color: rgba(255,255,255,0.72); font-size: 13px; margin-bottom:12px;">
          Secure PayPal checkout. After payment, return here and click “I already paid”.
        </div>

        <div class="btn-row">
          <a class="btn btn-primary" href="${CONFIG.PAYPAL_LINK}" target="_blank" rel="noopener noreferrer">Pay with PayPal</a>
          <button id="alreadyPaidBtn" class="btn" type="button">I already paid</button>
        </div>

        <div class="hint" style="margin-top:10px;">
          This is a simple unlock flow. For full verification, you will later connect PayPal webhooks.
        </div>
      </div>
    `;

    const alreadyPaidBtn = $("alreadyPaidBtn");
    if (alreadyPaidBtn) {
      alreadyPaidBtn.addEventListener("click", () => {
        if (!state.currentEmail) {
          setStatus("Please check an email first, then unlock payment for that email.");
          return;
        }
        markPaidForEmail(state.currentEmail);
        hideStatus();
        showDownload(state.currentEmail);
        setStatus("Payment unlock saved for this email. You can now download the PDF report.");
      });
    }
  }

  function generatePdf(email, breaches) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert("PDF library not loaded. Please refresh the page.");
      return;
    }

    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ExposureShield — Security Report", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Email: ${email}`, 14, 30);
    doc.text(`Breaches found: ${breaches.length}`, 14, 38);

    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.text("Breach List (top 10)", 14, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    (breaches || []).slice(0, 10).forEach((b, idx) => {
      const title = String(b?.Title || b?.Name || "Unknown");
      const date = String(b?.BreachDate || "");
      const domain = String(b?.Domain || "");
      const line = `${idx + 1}. ${title} — ${domain} — ${date}`;
      doc.text(line.substring(0, 95), 14, y);
      y += 7;
      if (y > 275) { doc.addPage(); y = 20; }
    });

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Recommended Actions", 14, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    const actions = [
      "Change passwords for affected accounts.",
      "Enable two-factor authentication (2FA).",
      "Use a password manager with unique passwords.",
      "Monitor accounts for suspicious activity.",
    ];
    actions.forEach((a) => {
      doc.text(`• ${a}`, 14, y);
      y += 7;
    });

    doc.save(`ExposureShield-Report-${email.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
  }

  async function onSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    const emailEl = $("hibpEmail");
    const resultEl = $("hibpResult");

    const email = (emailEl?.value || "").trim();
    if (!email || !email.includes("@")) {
      if (resultEl) resultEl.textContent = "Please enter a valid email address.";
      hidePremium();
      return;
    }

    state.currentEmail = email;
    state.currentBreaches = [];

    hideStatus();
    hideDownload();
    showPremium();
    buildPayPalUI();

    if (resultEl) {
      resultEl.innerHTML = `<div style="color:#38bdf8;">Checking ${escapeHtml(email)}...</div>`;
    }

    const url = `${CONFIG.EMAIL_CHECK_ENDPOINT}?email=${encodeURIComponent(email)}`;

    try {
      const { r, data } = await fetchJsonWithTimeout(url, CONFIG.REQUEST_TIMEOUT_MS);

      if (!r.ok) {
        const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `API error: ${r.status}`;
        if (resultEl) resultEl.innerHTML = `<div style="color:#fb7185;">${escapeHtml(msg)}</div>`;
        return;
      }

      const breaches = Array.isArray(data?.breaches) ? data.breaches : [];
      state.currentBreaches = breaches;

      renderResults(email, breaches);

      if (isPaidForEmail(email)) {
        showDownload(email);
        setStatus("Payment already saved for this email. You can download the PDF report.");
      } else {
        // Show premium pay option
        showPremium();
        buildPayPalUI();
        setStatus("To download the PDF report, please upgrade with PayPal.");
      }
    } catch (err) {
      const msg = err?.name === "AbortError" ? "Request timed out. Please try again." : (err?.message || String(err));
      if (resultEl) resultEl.innerHTML = `<div style="color:#fb7185;">${escapeHtml(msg)}</div>`;
    }
  }

  function onReset() {
    const resultEl = $("hibpResult");
    if (resultEl) resultEl.textContent = "Enter an email above to check for breaches.";
    state.currentEmail = "";
    state.currentBreaches = [];
    hideStatus();
    hidePremium();
    hideDownload();
  }

  function onDownload(e) {
    e.preventDefault();
    if (!state.currentEmail) {
      alert("No email selected. Please run a check first.");
      return;
    }
    if (!isPaidForEmail(state.currentEmail)) {
      alert("Please upgrade first to download the PDF report.");
      return;
    }
    generatePdf(state.currentEmail, state.currentBreaches || []);
  }

  function init() {
    // Footer year
    const yearEl = $("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const form = $("hibpForm");
    const downloadBtn = $("downloadPdfBtn");
    if (form) form.addEventListener("submit", onSubmit, true);
    if (form) form.addEventListener("reset", onReset);
    if (downloadBtn) downloadBtn.addEventListener("click", onDownload);

    // Keep premium hidden until first scan
    hidePremium();
    hideDownload();
    hideStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
