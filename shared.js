/* =========================================================
   ExposureShield â€“ shared.js (Production)
   Works with /api/hibp (Vercel Serverless Function)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("hibpForm") || document.getElementById("hibp-form");
  const emailInput = document.getElementById("hibpEmail") || document.getElementById("hibp-email");
  const resultBox = document.getElementById("hibpResult") || document.getElementById("hibp-result");
  const resetBtn = document.getElementById("hibpReset") || document.getElementById("hibp-reset");

  if (!form || !emailInput || !resultBox) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    if (!email) {
      showError("Please enter an email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/hibp?email=${encodeURIComponent(email)}`, {
        headers: { accept: "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(
          data?.error ||
          data?.details ||
          `Request failed (HTTP ${res.status})`
        );
      }

      renderBreaches(email, data.breaches || []);
    } catch (err) {
      showError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      emailInput.value = "";
      resultBox.innerHTML = "";
    });
  }

  /* ================= Helpers ================= */

  function setLoading(state) {
    if (state) {
      resultBox.innerHTML = `<div class="loading">Checking email securityâ€¦</div>`;
    }
  }

  function showError(msg) {
    resultBox.innerHTML = `
      <div class="error">
        <strong>Scan failed:</strong> ${msg}
      </div>
    `;
  }

  function renderBreaches(email, breaches) {
    const count = Array.isArray(breaches) ? breaches.length : 0;

    let risk = "Low";
    if (count >= 8) risk = "High";
    else if (count >= 3) risk = "Medium";

    if (count === 0) {
      resultBox.innerHTML = `
        <div class="safe">
          <h3>Good news</h3>
          <p>No known breaches found for <strong>${email}</strong>.</p>
          <p class="risk low">Risk Level: Low</p>
        </div>
      `;
      return;
    }

    const breachList = breaches
      .sort((a, b) =>
        (b.BreachDate || "").localeCompare(a.BreachDate || "")
      )
      .map(b => `
        <li>
          <strong>${b.Title || b.Name}</strong><br/>
          <small>${b.Domain || "Unknown domain"} â€¢ ${b.BreachDate || "Unknown date"}</small>
        </li>
      `)
      .join("");

    resultBox.innerHTML = `
      <div class="breaches">
        <h3>Security Alert</h3>
        <p>Your email <strong>${email}</strong> was found in
        <strong>${count}</strong> data breach${count > 1 ? "es" : ""}.</p>

        <p class="risk ${risk.toLowerCase()}">Risk Level: ${risk}</p>

        <ul class="breach-list">
          ${breachList}
        </ul>

        <div class="recommend">
          <h4>Recommended Actions</h4>
          <ul>
            <li>Change passwords for affected accounts</li>
            <li>Enable two-factor authentication</li>
            <li>Use a password manager</li>
            <li>Monitor accounts for suspicious activity</li>
          </ul>
        </div>

        <p class="powered">
          Secure check powered by Have I Been Pwned API
        </p>
      </div>
    `;
  }
});

