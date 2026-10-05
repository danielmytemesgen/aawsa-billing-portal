/**
 * Password Validator
 *
 * Shared validation module for password policy enforcement.
 * Used both server-side (in auth-actions.ts) and client-side (form UX).
 *
 * Policy:
 *   - Minimum 8 characters
 *   - At least 1 uppercase letter (A-Z)
 *   - At least 1 lowercase letter (a-z)
 *   - At least 1 digit (0-9)
 *   - At least 1 special character (!@#$%^&*_-)
 *   - Cannot be the same as current password
 */

export interface PasswordValidationResult {
  /** True only if ALL rules pass */
  isValid: boolean;
  /** Strength score 0-4 (0=very weak, 4=strong) */
  strength: 0 | 1 | 2 | 3 | 4;
  /** Human-readable strength label */
  strengthLabel: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** Individual rule results */
  rules: {
    minLength: boolean;       // >= 8 characters
    hasUppercase: boolean;    // At least one A-Z
    hasLowercase: boolean;    // At least one a-z
    hasDigit: boolean;        // At least one 0-9
    hasSpecial: boolean;      // At least one !@#$%^&*_-
  };
  /** Array of failure messages for display */
  errors: string[];
}

const SPECIAL_CHARS = /[!@#$%^&*_\-]/;
const UPPERCASE = /[A-Z]/;
const LOWERCASE = /[a-z]/;
const DIGIT = /[0-9]/;

/**
 * Validate a password against the AAWSA password policy.
 *
 * @param password - The candidate password string.
 * @returns        - Detailed validation result with per-rule status.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const rules = {
    minLength: password.length >= 8,
    hasUppercase: UPPERCASE.test(password),
    hasLowercase: LOWERCASE.test(password),
    hasDigit: DIGIT.test(password),
    hasSpecial: SPECIAL_CHARS.test(password),
  };

  const errors: string[] = [];
  if (!rules.minLength) errors.push('At least 8 characters');
  if (!rules.hasUppercase) errors.push('At least one uppercase letter (A-Z)');
  if (!rules.hasLowercase) errors.push('At least one lowercase letter (a-z)');
  if (!rules.hasDigit) errors.push('At least one number (0-9)');
  if (!rules.hasSpecial) errors.push('At least one special character (!@#$%^&*_-)');

  const isValid = errors.length === 0;

  // Strength: count how many rules pass (0-5 → map to 0-4)
  const passCount = Object.values(rules).filter(Boolean).length;
  let strength: 0 | 1 | 2 | 3 | 4;
  let strengthLabel: PasswordValidationResult['strengthLabel'];

  if (passCount <= 1) { strength = 0; strengthLabel = 'Very Weak'; }
  else if (passCount === 2) { strength = 1; strengthLabel = 'Weak'; }
  else if (passCount === 3) { strength = 2; strengthLabel = 'Fair'; }
  else if (passCount === 4) { strength = 3; strengthLabel = 'Good'; }
  else { strength = 4; strengthLabel = 'Strong'; }

  return { isValid, strength, strengthLabel, rules, errors };
}

/**
 * Quick check — returns true only if the password passes all policy rules.
 * Suitable for server-side guard clauses.
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).isValid;
}

/**
 * Generate a human-readable summary of all failing rules.
 *
 * @example
 *   const msg = getPasswordErrors('abc');
 *   // → "Password must have: At least 8 characters, At least one uppercase letter (A-Z), ..."
 */
export function getPasswordErrors(password: string): string | null {
  const { errors } = validatePassword(password);
  if (errors.length === 0) return null;
  return `Password must have: ${errors.join(', ')}.`;
}
