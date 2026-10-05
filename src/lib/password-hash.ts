import crypto from 'crypto';

const KEY_LEN = 64;

/**
 * Hash a password using Node.js native crypto.scrypt with a cryptographically secure random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a stored hash or fallback to legacy plaintext match.
 * Returns an object indicating whether the password matched, and whether the stored
 * record needs an automatic upgrade to scrypt.
 */
export function verifyPassword(password: string, storedHash: string): { matched: boolean; needsUpgrade: boolean } {
  if (!storedHash || !password) return { matched: false, needsUpgrade: false };

  // 1. Scrypt hashed format: scrypt:<salt>:<hash>
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return { matched: false, needsUpgrade: false };
    const [, salt, originalHash] = parts;
    try {
      const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
      const originalBuffer = Buffer.from(originalHash, 'hex');
      if (derivedKey.length !== originalBuffer.length) return { matched: false, needsUpgrade: false };
      const matched = crypto.timingSafeEqual(derivedKey, originalBuffer);
      return { matched, needsUpgrade: false };
    } catch {
      return { matched: false, needsUpgrade: false };
    }
  }

  // 2. Legacy plaintext match: if matched, flag for immediate upgrade
  const matched = storedHash === password;
  return { matched, needsUpgrade: matched };
}
