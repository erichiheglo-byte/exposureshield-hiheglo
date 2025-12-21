// ExposureShield - Professional JavaScript (Unified)
// Project root: C:\Users\erich\exposureshield-hiheglo
// Static site + Vercel API endpoints
// Email check endpoint (single source of truth): /api/hibp
// Contact endpoint: /api/contact

(function () {
  "use strict";

  // ----------------------------
  // Configuration
  // ----------------------------
  const EXPOSURE_SHIELD = {
    config: {
      APP_NAME: "ExposureShield",
      VERSION: "5.1.0",
      EMAIL_CHECK_ENDPOINT: "/api/hibp",
      CONTACT_ENDPOINT: "/api/contact",
      REQUEST_TIMEOUT_MS: 15000,
      MAX_BREACHES_RENDER: 5,
    },

    state: {
      isChecking: false,
    },

    // ----------------------------
    // Utilities
    // ----------------------------
    utils: {
      formatNumber: (num) => {
        if (num === undefined || num === null) return "Unknown";
        if (num === 0) return "0";
        const n = Number(num);
        if (!Number.isFinite(n)) return "Unknown";
        return n.toLocaleString();
      },

      formatDate: (dateString) => {
        if (!dateString) return "Date unknown";
        try {
          const date = new Date(dateString);
          if (Number.isNaN(date.getTime())) return "Date unknown";

          const now = new Date();
          const diffTime = Math.abs(now - date);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

          return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
        } catch {
          return "Date unknown";
        }
      },

      escapeHtml: (text) => {
        const div = document.createElement("div");
        div.textContent = String(text ?? "");
        return div.innerHTML;
      },

      // safe JSON parse
      safeJson: async (res) => {
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (!ct.includes("application/json")) return null;
        try {
          return await res.json();
        } catch {
          return null;
        }
      },
    },

    // ----------------------------
    // Init
    // ----------------------------
    init: function () {
      console.log(`🚀 ${this.config.APP_NAME} v${this.config.VERSION} starting...`);

      // Safe set: does nothing if elements not present
      this.setupMobileMenu();
      this.setupContactForm();

      // Email check supports BOTH UI variants (hibpForm or emailInput/checkBtn)
      this.setupEmailCheck();

      console.log("✅ ExposureShield initialized");
    },

    // ----------------------------
    // Mobile menu (safe no-op)
    // ----------------------------
    setupMobileMenu: function () {
      const menuBtn = document.querySelector(".mobile-menu-btn");
      const navLinks = document.querySelector(".nav-links");

      if (!menuBtn || !navLinks) return;

      menuBtn.addEventListener("click", () => {
        const open = navLinks.style.display === "flex";
        navLinks.style.display = open ? "none" : "flex";
        menuBtn.innerHTML = open ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
      });

      window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
          navLinks.style.display = "flex";
          menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        } else {
          navLinks.style.display = "none";
          menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        }
      });
    },

    // ----------------------------
    // Contact form
    // ----------------------------
    setupContactForm: function () {
      const contactBtn = document.getElementById("sendMessageBtn");
      if (!contactBtn) return;

      const showMessage = (text, type) => {
        const messageDiv = document.getElementById("contactMessageDisplay");
        if (!messageDiv) return;

        messageDiv.textContent = text;
        messageDiv.style.display = "block";
        messageDiv.style.background = type === "success" ? "#d1fae5" : "#fee2e2";
        messageDiv.style.color = type === "success" ? "#065f46" : "#991b1b";
        messageDiv.style.border = type === "success" ? "1px solid #a7f3d0" : "1px solid #fecaca";

        setTimeout(() => {
          messageDiv.style.display = "none";
        }, 5000);
      };

      contactBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const name = document.getElementById("contactName")?.value.trim() || "";
        const email = document.getElementById("contactEmail")?.value.trim() || "";
        const message = document.getElementById("contactMessageInput")?.value.trim() || "";

        if (!email.includes("@")) {
          showMessage("Please enter a valid email address", "error");
          return;
        }
        if (message.length < 10) {
          showMessage("Please enter a message (minimum 10 characters)", "error");
          return;
        }

        const originalText = contactBtn.innerHTML;
        contactBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        contactBtn.disabled = true;

        try {
          const response = await fetch(this.config.CONTACT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ name, email, message }),
          });

          const data = (await this.utils.safeJson(response)) || {};
          if (response.ok) {
            showMessage("✅ Message sent successfully! We'll respond within 24 hours.", "success");

            const n = document.getElementById("contactName");
            const em = document.getElementById("contactEmail");
            const msg = document.getElementById("contactMessageInput");
            if (n) n.value = "";
            if (em) em.value = "";
            if (msg) msg.value = "";
          } else {
            showMessage(`❌ ${data.error || "Failed to send message"}`, "error");
          }
        } catch (err) {
          console.error("Contact error:", err);
          showMessage("❌ Network error. Please email us directly.", "error");
        } finally {
          contactBtn.innerHTML = originalText;
          contactBtn.disabled = false;
        }
      });
    },

    // ----------------------------
    // Email check - supports BOTH UI patterns
    // ----------------------------
    setupEmailCheck: function () {
      // Pattern A (your new landing page):
      // form: hibpForm, input: hibpEmail, output: hibpResult
      const hibpForm = document.getElementById("hibpForm");
      const hibpEmail = document.getElementById("hibpEmail");
      const hibpResult = document.getElementById("hibpResult");

      if (hibpForm && hibpEmail && hibpResult) {
        // Capture submit early to prevent other scripts from also binding
        hibpForm.addEventListener(
          "submit",
          async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();

            const email = (hibpEmail.value || "").trim();
            if (!email || !email.includes("@")) {
              hibpResult.textContent = "Please enter a valid email address.";
              return;
            }

            const submitBtn = hibpForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            hibpResult.textContent = `Checking breaches for: ${email} ...`;

            try {
              const result = await this.checkEmail(email);
              const breaches = Array.isArray(result?.breaches) ? result.breaches : [];
              this.renderInlineHibpResult(hibpResult, email, breaches);
            } catch (err) {
              hibpResult.textContent = err?.message || "Network error. Please try again.";
            } finally {
              if (submitBtn) submitBtn.disabled = false;
            }
          },
          true
        );

        hibpForm.addEventListener("reset", () => {
          hibpResult.textContent = "Powered by Have I Been Pwned API";
        });

        console.log("✅ Email check ready (hibpForm)");
        return; // stop here; do not also bind pattern B
      }

      // Pattern B (older scan layout):
      // button: checkBtn, input: emailInput, results container: resultsContainer
      const button = document.getElementById("checkBtn");
      const emailInput = document.getElementById("emailInput");

      if (!button || !emailInput) {
        console.log("ℹ️ No email-check UI found on this page.");
        return;
      }

      button.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleScan(button);
      });

      emailInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.handleScan(button);
        }
      });

      console.log("✅ Email check ready (checkBtn/emailInput)");
    },

    // ----------------------------
    // API call - single endpoint (GET)
    // ----------------------------
    checkEmail: async function (email) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), this.config.REQUEST_TIMEOUT_MS);

      try {
        const url = `${this.config.EMAIL_CHECK_ENDPOINT}?email=${encodeURIComponent(email)}`;
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });

        const data = (await this.utils.safeJson(res)) || null;

        // HIBP "no breach" is often represented as 404 by upstream;
        // your Vercel function should normalize it. But handle anyway:
        if (res.status === 404) {
          return { ok: true, breaches: [] };
        }

        if (!res.ok) {
          throw new Error((data && (data.error || data.message)) || `API error: ${res.status}`);
        }

        if (!data) throw new Error("Unexpected response. Please try again.");
        return data;
      } catch (err) {
        if (err && err.name === "AbortError") {
          throw new Error("Request timed out. Please try again.");
        }
        throw err;
      } finally {
        clearTimeout(t);
      }
    },

    // ----------------------------
    // Pattern A renderer (hibpResult box)
    // ----------------------------
    renderInlineHibpResult: function (resultEl, email, breaches) {
      const count = breaches.length;

      if (count === 0) {
        resultEl.innerHTML = `
          <b style="color: rgba(52,211,153,0.95);">Good news:</b>
          No breaches found for <b>${this.utils.escapeHtml(email)}</b>.
        `;
        return;
      }

      const list = breaches
        .slice(0, 10)
        .map((b) => `<li><b>${this.utils.escapeHtml(b.Name || b.Title || "Breach")}</b>${b.BreachDate ? ` — ${this.utils.escapeHtml(b.BreachDate)}` : ""}</li>`)
        .join("");

      resultEl.innerHTML = `
        <div><b style="color: rgba(239,68,68,0.95);">Breaches found:</b> ${count}</div>
        <ul style="margin:10px 0 0 18px;">${list}</ul>
        ${count > 10 ? `<div style="margin-top:8px; opacity:.9;">Showing 10 of ${count} results.</div>` : ""}
      `;
    },

    // ----------------------------
    // Pattern B handler (resultsContainer renderer)
    // ----------------------------
    handleScan: async function (button) {
      if (this.state.isChecking) return;
      this.state.isChecking = true;

      const emailInput = document.getElementById("emailInput");
      const email = emailInput ? emailInput.value.trim() : "";

      if (!email || !email.includes("@")) {
        alert("Please enter a valid email address.");
        this.state.isChecking = false;
        return;
      }

      const originalHTML = button.innerHTML;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
      button.disabled = true;

      try {
        const result = await this.checkEmail(email);

        // If your modal exists, use it
        if (typeof window.showResultsModal === "function") {
          window.showResultsModal(result, email);
          return;
        }

        const breaches = Array.isArray(result?.breaches) ? result.breaches : [];
        this.showResults(email, breaches);
      } catch (err) {
        console.error("Scan error:", err);
        this.showError(err?.message || "Unable to check email");
      } finally {
        button.innerHTML = originalHTML;
        button.disabled = false;
        this.state.isChecking = false;
      }
    },

    // ----------------------------
    // Results rendering (Pattern B)
    // ----------------------------
    removeResults: function () {
      const container = document.getElementById("resultsContainer");
      if (container) container.innerHTML = "";
    },

    showResults: function (email, breaches) {
      this.removeResults();

      const container = document.getElementById("resultsContainer");
      if (!container) return;

      this.injectResultsStyles();

      if (!breaches || breaches.length === 0) {
        container.innerHTML = this.getNoBreachesHTML(email);
      } else {
        container.innerHTML = this.getBreachesHTML(email, breaches);
      }

      container.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    injectResultsStyles: function () {
      if (document.getElementById("results-styles")) return;

      const css = `
        .es-results { animation: fadeIn 0.5s ease-out; margin-top: 40px; }
        .es-result-card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid #e9ecef; }
        .es-result-safe { border-top: 5px solid #10b981; }
        .es-result-alert { border-top: 5px solid #ef4444; }
        .es-result-header { padding: 35px 40px; text-align: center; background: linear-gradient(135deg,#f8f9fa 0%,#e9ecef 100%); }
        .es-result-icon { width: 80px; height: 80px; margin: 0 auto 25px; border-radius: 50%; display:flex; align-items:center; justify-content:center; font-size:36px; }
        .es-icon-safe { background: rgba(16,185,129,0.1); color:#10b981; border:2px solid rgba(16,185,129,0.3); }
        .es-icon-alert { background: rgba(239,68,68,0.1); color:#ef4444; border:2px solid rgba(239,68,68,0.3); }
        .es-email-box { background:#f8f9fa; border-radius:12px; padding:25px; margin:0 40px 30px; text-align:center; border:1px solid #e9ecef; }
        .es-email-address { font-family: 'SF Mono', Monaco, monospace; font-size:20px; font-weight:700; color:#1f2937; word-break:break-all; }
        .es-stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin:0 40px 40px; }
        .es-stat { background: linear-gradient(135deg,#f8f9fa 0%,#e9ecef 100%); border-radius:12px; padding:25px; text-align:center; border:1px solid #dee2e6; }
        .es-stat-value { font-size:36px; font-weight:800; margin-bottom:8px; }
        .es-stat-label { color:#6b7280; font-size:14px; text-transform:uppercase; letter-spacing:0.8px; font-weight:600; margin-top:6px; }
        .es-breaches { margin:0 40px 40px; }
        .es-breach-item { display:flex; align-items:flex-start; padding:25px; margin-bottom:15px; background:#f8f9fa; border-radius:12px; border-left:4px solid #ef4444; }
        .es-breach-icon { width:50px; height:50px; background:white; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-right:20px; flex-shrink:0; font-size:22px; color:#6b7280; border:1px solid #e5e7eb; }
        .es-breach-content { flex:1; }
        .es-breach-name { font-size:18px; font-weight:700; margin:0 0 10px; color:#1f2937; }
        .es-breach-meta { display:flex; gap:20px; color:#6b7280; font-size:14px; flex-wrap:wrap; }
        .es-actions { margin:40px; padding:30px; background: linear-gradient(135deg,#fef3c7 0%,#fde68a 100%); border-radius:16px; border-left:5px solid #f59e0b; }
        .es-footer { padding:30px 40px; background:#f8f9fa; border-top:1px solid #e9ecef; text-align:center; }
        .es-button { padding:14px 32px; border-radius:10px; font-weight:600; cursor:pointer; transition:all 0.3s ease; border:none; font-size:16px; display:inline-flex; align-items:center; justify-content:center; gap:10px; min-width:180px; }
        .es-button-primary { background: linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%); color:white; }
        .es-button-primary:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(37,99,235,0.3); }
        @media (max-width:768px) {
          .es-result-header, .es-email-box, .es-stats, .es-breaches, .es-actions, .es-footer { margin:20px; padding:25px; }
          .es-stats { grid-template-columns:1fr; }
          .es-breach-meta { flex-direction:column; gap:8px; }
        }
      `;

      const style = document.createElement("style");
      style.id = "results-styles";
      style.textContent = css;
      document.head.appendChild(style);
    },

    getNoBreachesHTML: function (email) {
      return `
        <div class="es-results">
          <div class="es-result-card es-result-safe">
            <div class="es-result-header">
              <div class="es-result-icon es-icon-safe">
                <i class="fas fa-shield-check"></i>
              </div>
              <h2 style="margin:0 0 15px; font-size:32px; font-weight:800; color:#1f2937;">No Breaches Found</h2>
              <p style="color:#6b7280; font-size:18px; margin:0;">Your email appears secure</p>
            </div>

            <div class="es-email-box">
              <div style="font-size:14px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; font-weight:600;">Email Checked</div>
              <div class="es-email-address">${this.utils.escapeHtml(email)}</div>
            </div>

            <div style="padding:0 40px; text-align:center; margin-bottom:40px;">
              <p style="font-size:20px; color:#10b981; font-weight:600; margin:0 0 25px;">✅ Excellent! Your email hasn't been found in any known data breaches.</p>
              <p style="color:#6b7280; line-height:1.6; font-size:17px;">
                This means your email hasn't been publicly exposed in any major data breaches tracked by Have I Been Pwned.
                Keep up the good security practices!
              </p>
            </div>

            <div class="es-footer">
              <p style="color:#6b7280; margin-bottom:25px; font-size:15px; display:flex; align-items:center; justify-content:center; gap:10px;">
                <i class="fas fa-shield-alt" style="color:#10b981;"></i>
                Data provided by <strong>Have I Been Pwned</strong>
              </p>

              <div style="display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
                <button class="es-button es-button-primary" onclick="window.EXPOSURE_SHIELD.resetForNewScan()">
                  <i class="fas fa-search"></i>
                  Check Another Email
                </button>

                <button class="es-button" style="background:white; color:#6b7280; border:2px solid #e5e7eb;"
                        onclick="window.scrollTo({top:0, behavior:'smooth'})">
                  <i class="fas fa-arrow-up"></i>
                  Back to Top
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    getBreachesHTML: function (email, breaches) {
      const totalBreaches = breaches.length;

      const totalAccounts = breaches.reduce((sum, breach) => {
        return sum + (Number(breach?.PwnCount) || 0);
      }, 0);

      const latestBreach = breaches
        .filter((b) => b && b.BreachDate)
        .sort((a, b) => new Date(b.BreachDate) - new Date(a.BreachDate))[0];

      return `
        <div class="es-results">
          <div class="es-result-card es-result-alert">
            <div class="es-result-header">
              <div class="es-result-icon es-icon-alert">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <h2 style="margin:0 0 15px; font-size:32px; font-weight:800; color:#1f2937;">Security Alert</h2>
              <p style="color:#ef4444; font-size:18px; margin:0; font-weight:600;">
                ${totalBreaches} Data Breach${totalBreaches !== 1 ? "es" : ""} Found
              </p>
            </div>

            <div class="es-email-box">
              <div style="font-size:14px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; font-weight:600;">Compromised Email</div>
              <div class="es-email-address">${this.utils.escapeHtml(email)}</div>
            </div>

            <div class="es-stats">
              <div class="es-stat">
                <div class="es-stat-value" style="color:#ef4444;">${totalBreaches}</div>
                <div class="es-stat-label">Total Breaches</div>
              </div>

              <div class="es-stat">
                <div class="es-stat-value" style="color:${totalAccounts > 0 ? "#ef4444" : "#6b7280"}">${this.utils.formatNumber(totalAccounts)}</div>
                <div class="es-stat-label">Accounts Affected</div>
              </div>

              <div class="es-stat">
                <div class="es-stat-value" style="color:${latestBreach ? "#ef4444" : "#6b7280"}">
                  ${latestBreach ? this.utils.formatDate(latestBreach.BreachDate) : "N/A"}
                </div>
                <div class="es-stat-label">Latest Breach</div>
              </div>
            </div>

            <div class="es-breaches">
              <h3 style="margin:0 0 25px; color:#1f2937; font-size:24px; font-weight:700;">
                <i class="fas fa-list" style="margin-right:10px;"></i>
                Breach Details
              </h3>

              ${breaches
                .slice(0, this.config.MAX_BREACHES_RENDER)
                .map((breach) => {
                  const name = this.utils.escapeHtml(breach?.Name || breach?.Title || "Unknown");
                  const breachDate = this.utils.escapeHtml(breach?.BreachDate || "");
                  const pwn = Number(breach?.PwnCount) || 0;

                  return `
                    <div class="es-breach-item">
                      <div class="es-breach-icon">${breach?.Domain ? "🌐" : "⚠️"}</div>
                      <div class="es-breach-content">
                        <h4 class="es-breach-name">${name}</h4>
                        <div class="es-breach-meta">
                          <span><i class="far fa-calendar" style="margin-right:5px;"></i>${this.utils.formatDate(breachDate)}</span>
                          ${pwn ? `<span><i class="fas fa-users" style="margin-right:5px;"></i>${this.utils.formatNumber(pwn)} accounts</span>` : ""}
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")}

              ${
                breaches.length > this.config.MAX_BREACHES_RENDER
                  ? `<div style="opacity:.9; margin-top:10px;">Showing ${this.config.MAX_BREACHES_RENDER} of ${breaches.length} breaches.</div>`
                  : ""
              }
            </div>

            <div class="es-actions">
              <h3 style="margin:0 0 20px; color:#1f2937; font-size:24px; font-weight:700; display:flex; align-items:center; gap:10px;">
                <i class="fas fa-exclamation-circle"></i>
                Recommended Actions
              </h3>

              <ul style="list-style:none; padding:0; margin:0;">
                <li style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid rgba(245,158,11,0.2);">
                  <strong>1. Change Passwords:</strong> Update passwords for affected accounts immediately
                </li>
                <li style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid rgba(245,158,11,0.2);">
                  <strong>2. Enable 2FA:</strong> Add two-factor authentication to all critical accounts
                </li>
                <li style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid rgba(245,158,11,0.2);">
                  <strong>3. Use Password Manager:</strong> Generate unique passwords for every account
                </li>
                <li>
                  <strong>4. Monitor Accounts:</strong> Watch for suspicious activity and unauthorized access
                </li>
              </ul>
            </div>

            <div class="es-footer">
              <p style="color:#6b7280; margin-bottom:25px; font-size:15px; display:flex; align-items:center; justify-content:center; gap:10px;">
                <i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i>
                Breach data from <strong>Have I Been Pwned</strong>
              </p>

              <div style="display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
                <button class="es-button es-button-primary" onclick="window.EXPOSURE_SHIELD.resetForNewScan()">
                  <i class="fas fa-search"></i>
                  Check Another Email
                </button>

                <button class="es-button" style="background:white; color:#6b7280; border:2px solid #e5e7eb;"
                        onclick="window.scrollTo({top:0, behavior:'smooth'})">
                  <i class="fas fa-arrow-up"></i>
                  Back to Top
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    showError: function (message) {
      const container = document.getElementById("resultsContainer");
      if (!container) {
        alert(message || "We couldn't complete the security check right now.");
        return;
      }

      container.innerHTML = `
        <div class="es-results">
          <div style="background:#fef3c7; border:2px solid #f59e0b; border-radius:16px; padding:40px; text-align:center;">
            <div style="font-size:48px; margin-bottom:20px; color:#d97706;"><i class="fas fa-exclamation-circle"></i></div>
            <h3 style="margin:0 0 15px; color:#92400e; font-size:24px;">Temporary Service Issue</h3>
            <p style="color:#92400e; margin-bottom:25px; line-height:1.6;">${this.utils.escapeHtml(message || "We couldn't complete the security check at this moment.")}</p>
            <button onclick="window.EXPOSURE_SHIELD.resetForNewScan()"
                    style="background:#f59e0b; color:#92400e; border:none; padding:12px 30px; border-radius:8px; font-weight:600; cursor:pointer;">
              Try Again
            </button>
          </div>
        </div>
      `;
    },

    resetForNewScan: function () {
      this.removeResults();

      const emailInput = document.getElementById("emailInput") || document.querySelector(".email-input");
      if (emailInput) {
        emailInput.value = "";
        emailInput.focus();
      }

      const scanSection = document.getElementById("email-check") || document.getElementById("scan");
      if (scanSection) {
        scanSection.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      console.log("🔄 Ready for new scan");
    },
  };

  // Initialize on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => EXPOSURE_SHIELD.init());
  } else {
    setTimeout(() => EXPOSURE_SHIELD.init(), 50);
  }

  // Make globally available
  window.EXPOSURE_SHIELD = EXPOSURE_SHIELD;
})();

