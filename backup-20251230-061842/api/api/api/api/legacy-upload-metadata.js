// api/legacy-upload-metadata.js
import { json, readJson, verifyToken, getBearerToken } from "./_auth.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    const token = getBearerToken(req);
    const auth = token ? verifyToken(token) : null;
    if (!auth) return json(res, 401, { ok: false, error: "Unauthorized" });

    const { files } = await readJson(req);
    if (!Array.isArray(files)) return json(res, 400, { ok: false, error: "files[] is required." });

    // Return an “accepted” response; real file storage comes next with Blob
    return json(res, 200, { ok: true, accepted: files.length });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || "Server error." });
  }
}
