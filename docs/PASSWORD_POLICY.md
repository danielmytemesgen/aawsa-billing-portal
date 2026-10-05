# Password Policy — AAWSA Billing Portal

## Overview

All staff member passwords must meet the AAWSA password policy to protect sensitive customer and financial data.

---

## Password Requirements

| Rule | Requirement |
|---|---|
| **Minimum length** | At least **8 characters** |
| **Uppercase letter** | At least one `A–Z` |
| **Lowercase letter** | At least one `a–z` |
| **Number** | At least one `0–9` |
| **Special character** | At least one `! @ # $ % ^ & * _ -` |
| **Not reused** | Cannot match the last **3 passwords** |
| **Different from current** | Must differ from the current password |

---

## Password Strength Indicator

The change password form shows a real-time strength meter:

| Score | Label | Criteria |
|---|---|---|
| ⬛⬛⬛⬛ | Very Weak | ≤1 rule passes |
| 🟥⬛⬛⬛ | Weak | 2 rules pass |
| 🟧🟧⬛⬛ | Fair | 3 rules pass |
| 🟨🟨🟨⬛ | Good | 4 rules pass |
| 🟩🟩🟩🟩 | Strong | All 5 rules pass |

---

## Error Messages

If the password fails policy, the user sees a clear error:

> *Password must have: At least 8 characters, At least one uppercase letter (A-Z), At least one special character (!@#$%^&*_-).*

---

## Examples

| Password | Valid? | Reason |
|---|---|---|
| `aawsa123` | ❌ | No uppercase, no special char |
| `Aawsa123` | ❌ | No special character |
| `Aawsa123!` | ✅ | Meets all requirements |
| `P@ssw0rd` | ✅ | Meets all requirements |
| `12345678` | ❌ | No letters, no special char |

---

## How to Change Your Password

1. Log in to the portal
2. Click your **profile icon** (top right)
3. Select **Change Password**
4. Enter your **current password** for verification
5. Enter a **new password** meeting the requirements
6. Optionally check **"Sign out all other devices"**
7. Click **Save**

---

## Implementation Files

| File | Purpose |
|---|---|
| [`src/lib/password-validator.ts`](../src/lib/password-validator.ts) | Shared validation logic (server + client) |
| [`src/lib/auth-actions.ts`](../src/lib/auth-actions.ts) | Server-side `changePasswordAction` |
| [`database/migrations/022_audit_logs.sql`](../database/migrations/022_audit_logs.sql) | `password_history` table (reuse prevention) |
| [`src/lib/__tests__/password-policy.test.ts`](../src/lib/__tests__/password-policy.test.ts) | Unit tests |
