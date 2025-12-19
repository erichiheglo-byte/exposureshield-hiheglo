// shared.js - loads header/footer partials, highlights active nav, and wires dropdowns
(async function () {
  async function loadInto(id, url) {
    const el = document.getElementById(id);
    if (!el) return;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      el.innerHTML = await res.text();
    } catch (e) {
      console.error("[shared.js] Failed to load:", url, e);
      // fail soft: keep page usable
    }
  }

  function normalizePath(p) {
    if (!p) return "/";
    if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
    return p;
  }

  function setActiveNav() {
    const path = normalizePath(window.location.pathname);

    // map page to nav key
    const map = {
      "/": "home",
      "/index.html": "home",
      "/legacy": "legacy",
      "/legacy.html": "legacy",
      "/pricing": "pricing",
      "/pricing.html": "pricing",
      "/privacy": "privacy",
      "/privacy.html": "privacy",
      "/terms": "terms",
      "/terms.html": "terms",
      "/refund": "refund",
      "/refund.html": "refund",
    };

    const key = map[path] || null;
    if (!key) return;

    // Clear active states on all nav links (including dropdown links)
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.remove("is-active");
      a.setAttribute("aria-current", "false");
    });

    // Clear active state on dropdown toggles (Services button)
    document.querySelectorAll(".dropdown-toggle").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-current", "false");
    });

    // Set active on the matched link
    const active = document.querySelector(`[data-nav="${key}"]`);
    if (active) {
      active.classList.add("is-active");
      active.setAttribute("aria-current", "page");
    }

    // If active link is inside a dropdown, also mark the toggle as active
    const dropdownWrap = active ? active.closest(".nav-item.dropdown") : null;
    if (dropdownWrap) {
      const toggle = dropdownWrap.querySelector(".dropdown-toggle");
      if (toggle) {
        toggle.classList.add("is-active");
        toggle.setAttribute("aria-current", "page");
      }
    }
  }

  function wireDropdowns() {
    document.querySelectorAll(".nav-item.dropdown").forEach((wrap) => {
      const btn = wrap.querySelector(".dropdown-toggle");
      const menu = wrap.querySelector(".dropdown-menu");
      if (!btn || !menu) return;

      const close = () => {
        wrap.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      };

      const open = () => {
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      };

      btn.addEventListener("click", (e) => {
        e.preventDefault();

        const isOpen = wrap.classList.contains("is-open");

        // close any other open dropdowns
        document.querySelectorAll(".nav-item.dropdown.is-open").forEach((d) => {
          d.classList.remove("is-open");
          const b = d.querySelector(".dropdown-toggle");
          if (b) b.setAttribute("aria-expanded", "false");
        });

        if (!isOpen) open();
        else close();
      });

      // Close when clicking outside
      document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) close();
      });

      // Close on ESC
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
    });
  }

  // Load shared parts first, then set active state + dropdown behavior
  await loadInto("shared-header", "/partials/header.html");
  await loadInto("shared-footer", "/partials/footer.html");
  setActiveNav();
  wireDropdowns();
})();
