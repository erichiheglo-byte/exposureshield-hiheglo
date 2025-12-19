/* shared.js - ExposureShield (safe, no global collisions) */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    // Footer year
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // HIBP form elements
    const hibpForm = document.getElementById("hibpForm");
    const hibpEmail = document.getElementById("hibpEmail");
    const hibpResult = document.getElementById("hibpResult");

    // If this page doesn't have the HIBP form, do nothing
    if (!hibpForm || !hibpEmail || !hibpResult) return;

    const escapeHtml = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // ---------- Smart risk scoring (0-100) ----------
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    const parseDateMs = (b) => {
      const d = Date.parse(b?.BreachDate || b?.AddedDate || "");
      return Number.isFinite(d) ? d : 0;
    };

    const recencyPoints = (dateMs) => {
      if (!dateMs) return 0;
      const days = (Date.now() - dateMs) / (1000 * 60 * 60 * 24);

      if (days <= 180) return 12; // <= 6 months
      if (days <= 365) return 9; // <= 1 year
      if (days <= 3 * 365) return 6; // <= 3 years
      if (days <= 6 * 365) return 3; // <= 6 years
      return 1; // older
    };

    const classPoints = (dc) => {
      const s = String(dc || "").toLowerCase();

      // Highest impact
      if (s.includes("social security") || s.includes("ssn")) return 20;
      if (s.includes("password")) return 18;
      if (s.includes("credit card") || s.includes("payment")) return 18;
      if (s.includes("passport")) return 18;
      if (s.includes("bank") || s.includes("financial")) return 16;
      if (s.includes("government")) return 14;

      // High / moderate
      if (
        s.includes("authentication") ||
        s.includes("2fa") ||
        s.includes("security question")
      )
        return 14;

      if (s.includes("date of birth") || s.includes("birth")) return 10;
      if (s.includes("address")) return 8;
      if (s.includes("phone")) return 7;

      // Lower impact
      if (s.includes("email")) return 4;
      if (s.includes("username")) return 3;
      if (s.includes("name")) return 2;

      return 3;
    };

    const scoreOneBreach = (breach) => {
      let s = 0;

      // Any breach has baseline risk
      s += 8;

      // Verified / Sensitive
      if (breach?.IsVerified === true) s += 6;
      if (breach?.IsSensitive === true) s += 14;

      // Data classes (cap)
      const dcs = Array.isArray(breach?.DataClasses) ? breach.DataClasses : [];
      const dcSum = dcs.reduce((sum, dc) => sum + classPoints(dc), 0);
      s += Math.min(dcSum, 28);

      // Recency
      s += recencyPoints(parseDateMs(breach));

      // Optional: slight bump by size (PwnCount)
      const pwn = Number(breach?.PwnCount);
      if (Number.isFinite(pwn) && pwn > 0) {
        const bump = Math.min(6, Math.log10(pwn + 1)); // max +6
        s += bump;
      }

      return s;
    };

    const analyzeSignals = (breaches) => {
      const signals = {
        hasSensitive: false,
        hasVerified: false,
        hasPasswords: false,
        hasFinancial: false,
        hasIdentity: false,
        isRecent: false,
      };

      if (!Array.isArray(breaches) || breaches.length === 0) return signals;

      signals.hasSensitive = breaches.some((b) => b?.IsSensitive === true);
      signals.hasVerified = breaches.some((b) => b?.IsVerified === true);

      const allClasses = new Set();
      breaches.forEach((b) => {
        const dcs = Array.isArray(b?.DataClasses) ? b.DataClasses : [];
        dcs.forEach((x) => allClasses.add(String(x || "")));
      });
      const cls = Array.from(allClasses).map((x) => x.toLowerCase());

      signals.hasPasswords = cls.some((x) => x.includes("password"));
      signals.hasFinancial = cls.some((x) => {
        return (
          x.includes("credit card") ||
          x.includes("payment") ||
          x.includes("bank") ||
          x.includes("financial")
        );
      });
      signals.hasIdentity = cls.some((x) => {
        return (
          x.includes("social security") ||
          x.includes("ssn") ||
          x.includes("passport") ||
          x.includes("government")
        );
      });

      const newest = breaches
        .map(parseDateMs)
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || 0;
      signals.isRecent = recencyPoints(newest) >= 9; // <= 1 year

      return signals;
    };

    const computeOverallRisk = (breaches) => {
      if (!Array.isArray(breaches) || breaches.length === 0) {
        return {
          score: 0,
          label: "Low",
          reasons: ["No breaches found"],
          signals: analyzeSignals([]),
        };
      }

      const perScores = breaches.map(scoreOneBreach);
      const raw = perScores.reduce((a, b) => a + b, 0);

      // Normalize raw -> 0..100 (raw ~140 maps to 100)
      const score = clamp(Math.round((raw / 140) * 100), 0, 100);

      let label = "Low";
      if (score >= 70) label = "High";
      else if (score >= 35) label = "Medium";

      const signals = analyzeSignals(breaches);

      // Reasons (short)
      const reasons = [];
      if (signals.hasPasswords) reasons.push("Passwords exposed");
      if (signals.hasFinancial) reasons.push("Financial data involved");
      if (signals.hasIdentity) reasons.push("Identity data involved");
      if (signals.hasSensitive) reasons.push("Sensitive breach");
      if (signals.hasVerified) reasons.push("Verified breach");
      if (signals.isRecent) reasons.push("Recent breach");

      const reasonsShort = reasons.slice(0, 3);
      if (reasonsShort.length === 0) reasonsShort.push("General exposure");

      return { score, label, reasons: reasonsShort, signals };
    };

    const actionsForSignals = (signals) => {
      const actions = [];

      if (signals.hasPasswords) {
        actions.push({
          title: "Change passwords immediately",
          text:
            "Update passwords for affected accounts, and do not reuse old passwords. Use a password manager to create strong, unique passwords.",
        });
      } else {
        actions.push({
          title: "Use strong, unique passwords",
          text:
            "Even if passwords were not exposed, using unique passwords reduces damage from future breaches.",
        });
      }

      actions.push({
        title: "Enable two-factor authentication (2FA)",
        text:
          "Turn on 2FA where available, especially for email and financial accounts. This blocks many account takeover attempts.",
      });

      if (signals.hasFinancial) {
        actions.push({
          title: "Monitor payment methods",
          text:
            "Review bank and card statements for unusual activity. Consider replacing cards if you suspect exposure.",
        });
      }

      if (signals.hasIdentity) {
        actions.push({
          title: "Protect against identity fraud",
          text:
            "Consider a fraud alert or credit freeze. Monitor your credit reports and watch for new accounts you did not open.",
        });
      }

      if (signals.hasSensitive || signals.isRecent || signals.hasVerified) {
        actions.push({
          title: "Watch for phishing and scams",
          text:
            "Expect targeted emails/texts. Verify links, avoid sharing codes, and confirm requests through official channels.",
        });
      } else {
        actions.push({
          title: "Stay alert for suspicious messages",
          text:
            "Be cautious with emails asking for logins, payments, or personal information. Use official websites and apps.",
        });
      }

      return actions.slice(0, 5);
    };

    const riskColor = (label) => {
      if (label === "High") return "rgba(248,113,113,0.95)";
      if (label === "Medium") return "rgba(251,191,36,0.95)";
      return "rgba(52,211,153,0.95)";
    };

    function renderBreaches(email, breaches) {
      const list = Array.isArray(breaches) ? breaches : [];
      const count = list.length;

      const risk = computeOverallRisk(list);

      if (count === 0) {
        hibpResult.innerHTML = `
          <b style="color: rgba(52,211,153,0.95);">Good news:</b>
          No breaches found for <b>${escapeHtml(email)}</b>.
          <div class="hint" style="margin-top:8px;">Powered by Have I Been Pwned API</div>
        `;
        return;
      }

      const sorted = list.slice().sort((a, b) => {
        const da = Date.parse((a && (a.BreachDate || a.AddedDate)) || "") || 0;
        const db = Date.parse((b && (b.BreachDate || b.AddedDate)) || "") || 0;
        return db - da;
      });

      const topBreaches = sorted.slice(0, 8);

      const listHtml = topBreaches
        .map((b) => {
          const name = escapeHtml((b && (b.Title || b.Name)) || "Unknown");
          const date = escapeHtml((b && b.BreachDate) || "");
          const domain = escapeHtml((b && b.Domain) || "");
          const line2 = [domain, date].filter(Boolean).join(" • ");

          return `
            <li style="margin: 6px 0;">
              <b>${name}</b>
              ${
                line2
                  ? `<div style="color: rgba(255,255,255,0.72); font-size: 12px; margin-top: 2px;">${line2}</div>`
                  : ""
              }
            </li>
          `;
        })
        .join("");

      const actions = actionsForSignals(risk.signals);
      const actionsHtml = actions
        .map(
          (a) => `
            <li style="margin: 8px 0;">
              <b>${escapeHtml(a.title)}</b>
              <div style="color: rgba(255,255,255,0.76); font-size: 12.5px; margin-top: 2px; line-height: 1.35;">
                ${escapeHtml(a.text)}
              </div>
            </li>
          `
        )
        .join("");

      hibpResult.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div><b>${count} breach(es) found</b> for <b>${escapeHtml(email)}</b>.</div>
          <div class="tag" style="display:inline-flex; align-items:center; gap:10px;">
            <span>Risk:</span>
            <b style="color:${riskColor(risk.label)};">${risk.label}</b>
            <span style="opacity:0.85;">Score: <b>${risk.score}/100</b></span>
          </div>
        </div>

        <div style="margin-top:8px; color: rgba(255,255,255,0.78); font-size: 13px;">
          <b>Why:</b> ${risk.reasons.map(escapeHtml).join("; ")}.
        </div>

        <div style="margin-top:12px; padding:12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.04);">
          <div style="font-weight:700; margin-bottom:6px;">Recommended actions</div>
          <ul style="margin:0; padding-left: 18px; color: rgba(255,255,255,0.90);">
            ${actionsHtml}
          </ul>
        </div>

        <ul style="margin:12px 0 0; padding-left: 18px; color: rgba(255,255,255,0.86);">
          ${listHtml}
        </ul>

        <div class="hint" style="margin-top:10px;">
          ${
            count > topBreaches.length
              ? `Showing top ${topBreaches.length} of ${count} breaches.`
              : `Powered by Have I Been Pwned API`
          }
        </div>
      `;
    }

    hibpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const email = (hibpEmail.value || "").trim();
      if (!email) {
        hibpResult.textContent = "Please enter an email address.";
        return;
      }

      hibpResult.textContent = `Checking breaches for: ${email} ...`;

      const submitBtn = hibpForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const r = await fetch(`/api/hibp?email=${encodeURIComponent(email)}`, {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        });

        const data = await r.json().catch(() => null);

        if (!r.ok || !data || data.ok !== true) {
          hibpResult.textContent = "Unable to check right now. Please try again.";
          return;
        }

        renderBreaches(email, data.breaches);
      } catch {
        hibpResult.textContent = "Network error. Please try again.";
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    hibpForm.addEventListener("reset", () => {
      hibpResult.textContent = "Powered by Have I Been Pwned API";
    });
  });
})();