import { applyCors } from '../_lib/cors.js'
import { getStore } from '../_lib/store.js'

const store = getStore()

export default async function handler(req, res) {
  await applyCors(req, res)
  
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  
  const { refreshToken } = req.body
  
  if (refreshToken) {
    // Add to blacklist (in production, use Redis)
    await store.refreshTokens.set(refreshToken, {
      revoked: true,
      revokedAt: new Date().toISOString()
    })
  }
  
  return res.status(200).json({ ok: true, message: 'Logged out successfully' })
}