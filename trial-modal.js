document.addEventListener("DOMContentLoaded", () => {

  // Start trial buttons (opens modal)
  const startTrialBtn = document.getElementById("startTrial");
  const finalTrialBtn = document.getElementById("finalTrialBtn");

  if (startTrialBtn) startTrialBtn.addEventListener("click", showTrialModal);
  if (finalTrialBtn) finalTrialBtn.addEventListener("click", showTrialModal);

  function showTrialModal() {
    const modal = document.createElement("div");
    modal.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "right: 0",
      "bottom: 0",
      "background: rgba(15, 23, 42, 0.95)",
      "backdrop-filter: blur(5px)",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "z-index: 2000",
      "padding: 1rem"
    ].join(";");

    modal.innerHTML = `
      <div style="background: white; padding: 2.5rem; border-radius: 16px; max-width: 500px; width: 100%; position: relative;">
        <button id="trial-modal-close"
          aria-label="Close"
          style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280;">
          &times;
        </button>

        <h3 style="margin: 0 0 0.5rem; color: #0f172a;">Start Your Free Trial</h3>
        <p style="color: #64748b; margin: 0 0 2rem;">Get 14 days of full access to all ExposureShield features.</p>

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
          <input type="email" placeholder="Your email address"
            style="padding: 1rem; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem;" />
          <input type="password" placeholder="Create a password"
            style="padding: 1rem; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem;" />
        </div>

        <button id="trial-modal-start" class="btn btn-primary" style="width: 100%; padding: 1rem;">
          Start 14-Day Free Trial
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector("#trial-modal-close");
    const startBtn = modal.querySelector("#trial-modal-start");

    if (closeBtn) closeBtn.addEventListener("click", () => modal.remove());

    if (startBtn) {
      startBtn.addEventListener("click", () => {
        window.location.href = "https://app.exposureshield.com/signup";
      });
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    document.addEventListener(
      "keydown",
      function onEsc(e) {
        if (e.key === "Escape") {
          modal.remove();
          document.removeEventListener("keydown", onEsc);
        }
      }
    );
  }

});
