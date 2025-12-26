// ===== LIVE HIBP EMAIL CHECK (uses /api/check-email) =====
document.addEventListener("DOMContentLoaded", () => {
  const hibpForm = document.getElementById("hibpForm");
  const hibpEmail = document.getElementById("hibpEmail");
  const hibpResult = document.getElementById("hibpResult");

  if (!hibpForm || !hibpEmail || !hibpResult) return;

  const API = "/api/check-email";

  const escapeHtml = (s) => {
    const d = document.createElement("div");
    d.textContent = String(s ?? "");
    return d.innerHTML;
  };

  const riskLabel = (count) => {
    if (count >= 8) return { label: "High", color: "#fb7185" };
    if (count >= 3) return { label: "Medium", color: "#fbbf24" };
    return { label: "Low", color: "#34d399" };
  };

  function render(email, breaches) {
    const list = Array.isArray(breaches) ? breaches : [];
    const count = list.length;
    const risk = riskLabel(count);

    if (count === 0) {
      hibpResult.innerHTML = `
        <div style="margin-bottom:10px;">
          <b style="color:#34d399;">Good news:</b>
          No breaches found for <b>${escapeHtml(email)}</b>.
        </div>
        <div style="display:inline-flex; padding:6px 10px; border-radius:999px; border:1px solid rgba(52,211,153,0.3); background:rgba(52,211,153,0.1); color:#34d399; font-weight:800;">
          Risk Level: Low
        </div>
        <div class="hint" style="margin-top:12px; opacity:.75;">Secure check powered by Have I Been Pwned</div>
      `;
      return;
    }

    const sorted = [...list].sort((a, b) => {
      const da = new Date(a?.BreachDate || 0).getTime();
      const db = new Date(b?.BreachDate || 0).getTime();
      return db - da;
    });

    const items = sorted.map((b) => {
      const title = escapeHtml(b?.Title || b?.Name || "Unknown");
      const date = escapeHtml(b?.BreachDate || "Unknown date");
      const domain = escapeHtml(b?.Domain || "");
      const classes = Array.isArray(b?.DataClasses) ? b.DataClasses.slice(0, 4).map(escapeHtml).join(", ") : "";
      const link = b?.Name ? `https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b.Name)}` : null;

      return `
        <div style="margin:10px 0; padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div>
              <div style="font-weight:800; color:rgba(255,255,255,0.92);">${title}</div>
              <div style="margin-top:4px; font-size:12px; color:rgba(255,255,255,0.70);">
                ${domain ? `${domain} • ` : ""}${date}${classes ? ` • ${classes}` : ""}
              </div>
            </div>
            ${link ? `<a class="btn" style="padding:8px 10px; font-size:12px;" href="${link}" target="_blank" rel="noreferrer">Details</a>` : ""}
          </div>
        </div>
      `;
    }).join("");

    hibpResult.innerHTML = `
      <div style="margin-bottom:10px;">
        <b style="color:#fb7185;">Security Alert</b><br/>
        Your email <b>${escapeHtml(email)}</b> was found in <b>${count}</b> breach${count !== 1 ? "es" : ""}.
      </div>

      <div style="display:inline-flex; margin-bottom:12px; padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.05); color:${risk.color}; font-weight:800;">
        Risk Level: ${risk.label}
      </div>

      ${items}

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

  hibpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (hibpEmail.value || "").trim();
    if (!email || !email.includes("@")) {
      hibpResult.innerHTML = `<div style="color:#fb7185;">Please enter a valid email address.</div>`;
      return;
    }

    hibpResult.innerHTML = `<div style="color:#38bdf8;">Checking ${escapeHtml(email)}…</div>`;

    try {
      const res = await fetch(`${API}?email=${encodeURIComponent(email)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && (data.error || data.message)) || `API error: ${res.status}`);
      }

      render(email, data?.breaches || []);
    } catch (err) {
      hibpResult.innerHTML = `<div style="color:#fb7185;">${escapeHtml(err?.message || err)}</div>`;
    }
  });

  hibpForm.addEventListener("reset", () => {
    hibpResult.innerHTML = "Enter email above to check for breaches.";
  });
});
