// api/_lib/store.js - UPDATED FOR UPSTASH REDIS
const { Redis } = require('@upstash/redis');

let redisClient = null;

// 1. INITIALIZE THE CORRECT CLIENT
try {
  // Use the exact variable names from your Vercel project
  redisClient = new Redis({
    url: process.env.KV_REST_API_URL,        // "https://lucky-chamois-9204.upstash.io"
    token: process.env.KV_REST_API_TOKEN,    // Your token starting with "ASP0AA..."
  });
  console.log('SUCCESS: Upstash Redis client initialized.');
} catch (error) {
  console.error('FAILED to initialize Redis client:', error);
  redisClient = null;
}

const USER_PREFIX = 'user:';
const EMAIL_INDEX_PREFIX = 'email:';

function getUserKey(id) { return USER_PREFIX + id; }
function getEmailKey(email) { return EMAIL_INDEX_PREFIX + email.toLowerCase().trim(); }

// 2. SAVE USER TO REDIS (Register function calls this)
async function createUser(userData) {
  if (!redisClient) {
    throw new Error('Redis client not available. Cannot save user.');
  }
  const id = userData.id;
  const emailKey = getEmailKey(userData.email);
  const userKey = getUserKey(id);

  // Save both the user object and the email->ID index in one atomic operation
  const pipeline = redisClient.pipeline();
  pipeline.set(emailKey, id); // Index: email -> user ID
  pipeline.set(userKey, JSON.stringify(userData)); // Store full user
  await pipeline.exec();

  console.log(`DEBUG: User saved. Email Key: ${emailKey}, User Key: ${userKey}`);
  return userData;
}

// 3. FIND USER BY EMAIL (Login function calls this)
async function getUserByEmail(email) {
  if (!redisClient || !email) return null;

  const emailKey = getEmailKey(email);
  console.log(`DEBUG: Looking up email key: ${emailKey}`);

  // First, get the user ID from the email index
  const userId = await redisClient.get(emailKey);
  console.log(`DEBUG: Found User ID for email: ${userId}`);

  if (!userId) return null; // No user found with this email

  // Then, get the full user data using the ID
  return await getUserById(userId);
}

// 4. FIND USER BY ID (Helper for getUserByEmail)
async function getUserById(id) {
  if (!redisClient || !id) return null;
  const userKey = getUserKey(id);
  const data = await redisClient.get(userKey);
  return data ? JSON.parse(data) : null;
}

module.exports = {
  createUser,
  getUserById,
  getUserByEmail
};