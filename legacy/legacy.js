// legacy/legacy.js
(function () {
  function getToken() {
    // Adjust this key if your login stores token under a different name
    return localStorage.getItem("token") || localStorage.getItem("access_token") || "";
  }

  function requireLogin() {
    const t = getToken();
    if (!t) {
      // Send user to login, then back here
      const next = encodeURIComponent("/legacy/");
      window.location.href = `/login.html?next=${next}`;
      return false;
    }
    return true;
  }

  async function apiGetPlan() {
    const token = getToken();
    const res = await fetch("/api/legacy/get", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    return res.json();
  }

  async function apiSavePlan(plan) {
    const token = getToken();
    const res = await fetch("/api/legacy/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ plan })
    });
    return res.json();
  }

  function setStatus(msg) {
    const el = document.getElementById("statusMsg");
    if (el) el.textContent = msg || "";
  }

  function readForm() {
    return {
      fullName: document.getElementById("fullName").value.trim(),
      emergencyContact: document.getElementById("emergencyContact").value.trim(),
      notes: document.getElementById("notes").value.trim(),
      beneficiaries: [],
      trustees: [],
      assets: []
    };
  }

  function fillForm(plan) {
    document.getElementById("fullName").value = plan?.fullName || "";
    document.getElementById("emergencyContact").value = plan?.emergencyContact || "";
    document.getElementById("notes").value = plan?.notes || "";
  }

  async function init() {
    if (!requireLogin()) return;

    setStatus("Loading your legacy plan...");
    try {
      const data = await apiGetPlan();
      if (!data.ok) {
        setStatus(data.error || "Unable to load legacy plan");
        return;
      }
      if (data.plan) fillForm(data.plan);
      setStatus("Loaded.");
    } catch (e) {
      setStatus("Error loading legacy plan.");
    }

    const saveBtn = document.getElementById("saveBtn");
    saveBtn.addEventListener("click", async () => {
      setStatus("Saving...");
      try {
        const plan = readForm();
        const data = await apiSavePlan(plan);
        if (!data.ok) {
          setStatus(data.error || "Save failed");
          return;
        }
        setStatus("Saved successfully.");
      } catch (e) {
        setStatus("Error saving legacy plan.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
