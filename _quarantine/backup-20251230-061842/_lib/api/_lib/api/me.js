// api/me.js
import { applyCors } from "./_lib/cors.js";
import { requireAuth } from "./_lib/auth.js";
import { getUserByEmail } from "./_lib/store.js";

export default async function handler(req, res) {
  if (applyCors(req, res, "GET,OPTIONS")) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  try {
    const email = (auth.email || "").toString().toLowerCase();
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tokenPayload: auth
    });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: "Failed to load user" });
  }
}
