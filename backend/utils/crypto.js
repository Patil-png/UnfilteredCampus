const crypto = require('crypto');
require('dotenv').config();

/**
 * Mask the real user identity using a one-way SHA-256 hash with a secret salt.
 * This ensures anonymity while allowing persistent user mapping (e.g., for bans).
 * @param {string} realUserId - The unique UUID from Supabase Auth
 * @returns {string} - The hashed anonymous ID
 */
function generateAnonymousId(realUserId) {
  const secretSalt = process.env.MY_SECRET_APP_SALT;
  if (!secretSalt) {
    throw new Error('MY_SECRET_APP_SALT is not defined in environment variables');
  }
  
  return crypto.createHmac('sha256', secretSalt)
               .update(String(realUserId))
               .digest('hex');
}

module.exports = { generateAnonymousId };
