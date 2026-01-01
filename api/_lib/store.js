// api/_lib/store.js - FINAL WORKING VERSION
const { Redis } = require('@upstash/redis');

let redisClient = null;

// Initialize the Redis client
try {
  // Use the environment variables FROM YOUR VERSCEL PROJECT
  redisClient = new Redis({
    url: process.env.KV_REST_API_URL,        // "https://lucky-chamois-9204.upstash.io"
    token: process.env.KV_REST_API_TOKEN,    // Your ASP0AA... token
  });
  console.log('SUCCESS: Upstash Redis client initialized.');
} catch (error) {
  console.error('FAILED to initialize Redis client:', error);
  // In production, don't fall back to memory
  redisClient = null;
}

// Key prefix constants
const USER_PREFIX = 'user:';
const EMAIL_INDEX_PREFIX = 'email:';

// Helper functions for key generation
function getUserKey(id) { 
  return USER_PREFIX + id; 
}

function getEmailKey(email) { 
  return EMAIL_INDEX_PREFIX + email.toLowerCase().trim(); 
}

// CREATE USER (called by register.js)
async function createUser(userData) {
  if (!redisClient) {
    throw new Error('Redis client not available. Cannot save user.');
  }
  
  const id = userData.id;
  const emailKey = getEmailKey(userData.email);
  const userKey = getUserKey(id);

  // Save both the user object and email->ID index atomically
  const pipeline = redisClient.pipeline();
  pipeline.set(emailKey, id);                    // Index: email -> user ID
  pipeline.set(userKey, JSON.stringify(userData)); // Store full user object
  await pipeline.exec();

  console.log(`DEBUG: User saved. Email: ${emailKey}, User: ${userKey}`);
  return userData;
}

// GET USER BY EMAIL (called by login.js)
async function getUserByEmail(email) {
  if (!redisClient || !email) return null;

  const emailKey = getEmailKey(email);
  
  // First, get the user ID from the email index
  const userId = await redisClient.get(emailKey);
  if (!userId) {
    console.log(`DEBUG: No user found for email: ${email}`);
    return null;
  }

  // Then, get the full user data using the ID
  return await getUserById(userId);
}

// GET USER BY ID (helper function)
async function getUserById(id) {
  if (!redisClient || !id) return null;
  
  const userKey = getUserKey(id);
  const data = await redisClient.get(userKey);
  
  if (!data) {
    console.log(`DEBUG: No user data found for ID: ${id}`);
    return null;
  }
  
  return JSON.parse(data);
}

module.exports = {
  createUser,
  getUserById,
  getUserByEmail
};