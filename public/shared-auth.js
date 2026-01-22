window.ExposureShieldAuth = {
function getEmailValue() {
  const byId = document.getElementById("email");
  const byType = document.querySelector('input[type="email"]');
  return String((byId && byId.value) || (byType && byType.value) || "").trim().toLowerCase();
}
function getPasswordValue() {
  const byId = document.getElementById("password");
  const byType = document.querySelector('input[type="password"]');
  return String((byId && byId.value) || (byType && byType.value) || "").trim();
}
  async login(email, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Login failed");
    }

    return data;
  },

  async logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
  },

  async me() {
    const res = await fetch("/api/user/profile", {
      credentials: "include"
    });
    return res.json();
  }
};


