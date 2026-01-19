import { applyCors } from '../_lib/cors.js'
import { verifyToken, generateToken } from '../_lib/jwt.js'
import { getStore } from '../_lib/store.js'

const store = getStore()

export default async function handler(req, res) {
  await applyCors(req, res)
  
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  
  try {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      return res.status(400).json({ ok: false, error: 'Refresh token required' })
    }
    
    // Verify refresh token
    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET)
    
    // Get user from store
    const user = await store.users.get(decoded.userId)
    
    if (!user) {
      return res.status(401).json({ ok: false, error: 'User not found' })
    }
    
    // Generate new tokens
    const token = generateToken(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      '7d'
    )
    
    const newRefreshToken = generateToken(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      '30d'
    )
    
    return res.status(200).json({
      ok: true,
      token,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    })
    
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Invalid refresh token' })
  }
}