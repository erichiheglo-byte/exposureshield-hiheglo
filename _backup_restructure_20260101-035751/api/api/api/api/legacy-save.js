// api/legacy-save.js
import { kv } from "@vercel/kv";
import { json, readJson, verifyToken, getBearerToken } from "./_auth.js";
import crypto from "crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    const token = getBearerToken(req);
    const auth = token ? verifyToken(token) : null;
    if (!auth) return json(res, 401, { ok: false, error: "Unauthorized" });

    const planData = await readJson(req);
    if (!planData || typeof planData !== "object") return json(res, 400, { ok: false, error: "Missing plan data." });

    const planId = (planData?.metadata?.planId && String(planData.metadata.planId)) || `LEGACY-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const record = {
      ...planData,
      metadata: {
        ...(planData.metadata || {}),
        planId,
        ownerUserId: auth.sub,
        savedAt: new Date().toISOString(),
        version: planData?.metadata?.version || "1.0",
      },
    };

    const key = `legacy:${auth.sub}:${planId}`;
    await kv.set(key, record);

    // index for quick lookup
    await kv.set(`legacy_latest:${auth.sub}`, planId);

    return json(res, 200, { ok: true, planId });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || "Server error." });
  }
}
