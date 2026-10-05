import { describe, it, expect } from 'vitest';
import { validatePassword, isPasswordValid, getPasswordErrors } from '../password-validator';

describe('validatePassword', () => {
  // ─── All rules pass ─────────────────────────────────────
  it('accepts a strong password', () => {
    const result = validatePassword('Aawsa@2026');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.strength).toBe(4);
    expect(result.strengthLabel).toBe('Strong');
  });

  it('accepts another strong password', () => {
    const result = validatePassword('P@ssw0rd!');
    expect(result.isValid).toBe(true);
    expect(result.rules.minLength).toBe(true);
    expect(result.rules.hasUppercase).toBe(true);
    expect(result.rules.hasLowercase).toBe(true);
    expect(result.rules.hasDigit).toBe(true);
    expect(result.rules.hasSpecial).toBe(true);
  });

  // ─── Individual rule failures ────────────────────────────
  it('fails when too short', () => {
    const r = validatePassword('Ab1!');
    expect(r.rules.minLength).toBe(false);
    expect(r.errors).toContain('At least 8 characters');
    expect(r.isValid).toBe(false);
  });

  it('fails when no uppercase', () => {
    const r = validatePassword('aawsa@2026');
    expect(r.rules.hasUppercase).toBe(false);
    expect(r.errors).toContain('At least one uppercase letter (A-Z)');
    expect(r.isValid).toBe(false);
  });

  it('fails when no lowercase', () => {
    const r = validatePassword('AAWSA@2026');
    expect(r.rules.hasLowercase).toBe(false);
    expect(r.errors).toContain('At least one lowercase letter (a-z)');
    expect(r.isValid).toBe(false);
  });

  it('fails when no digit', () => {
    const r = validatePassword('Aawsa@Pass');
    expect(r.rules.hasDigit).toBe(false);
    expect(r.errors).toContain('At least one number (0-9)');
    expect(r.isValid).toBe(false);
  });

  it('fails when no special character', () => {
    const r = validatePassword('Aawsa12345');
    expect(r.rules.hasSpecial).toBe(false);
    expect(r.errors).toContain('At least one special character (!@#$%^&*_-)');
    expect(r.isValid).toBe(false);
  });

  // ─── Strength scoring ────────────────────────────────────
  it('scores very weak for 1 rule passing', () => {
    const r = validatePassword('a');
    expect(r.strength).toBe(0);
    expect(r.strengthLabel).toBe('Very Weak');
  });

  it('scores weak for 2 rules passing', () => {
    const r = validatePassword('abcdefgh'); // minLength + hasLowercase
    expect(r.strength).toBe(1);
    expect(r.strengthLabel).toBe('Weak');
  });

  it('scores fair for 3 rules passing', () => {
    const r = validatePassword('Abcdefgh'); // minLength + hasLowercase + hasUppercase
    expect(r.strength).toBe(2);
    expect(r.strengthLabel).toBe('Fair');
  });

  it('scores good for 4 rules passing', () => {
    const r = validatePassword('Abcdef1g'); // minLength + upper + lower + digit
    expect(r.strength).toBe(3);
    expect(r.strengthLabel).toBe('Good');
  });

  it('scores strong for all 5 rules passing', () => {
    const r = validatePassword('Aawsa@2026');
    expect(r.strength).toBe(4);
    expect(r.strengthLabel).toBe('Strong');
  });

  // ─── Edge cases ──────────────────────────────────────────
  it('returns very weak for empty string', () => {
    const r = validatePassword('');
    expect(r.isValid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('accepts all defined special characters', () => {
    for (const ch of ['!', '@', '#', '$', '%', '^', '&', '*', '_', '-']) {
      const r = validatePassword(`Aawsa${ch}2026`);
      expect(r.rules.hasSpecial).toBe(true);
    }
  });
});

describe('isPasswordValid', () => {
  it('returns true for valid password', () => {
    expect(isPasswordValid('Aawsa@2026')).toBe(true);
  });

  it('returns false for invalid password', () => {
    expect(isPasswordValid('weak')).toBe(false);
  });
});

describe('getPasswordErrors', () => {
  it('returns null for valid password', () => {
    expect(getPasswordErrors('Aawsa@2026')).toBeNull();
  });

  it('returns error string for invalid password', () => {
    const msg = getPasswordErrors('weak');
    expect(msg).not.toBeNull();
    expect(msg).toContain('Password must have:');
    expect(msg).toContain('At least 8 characters');
  });
});
