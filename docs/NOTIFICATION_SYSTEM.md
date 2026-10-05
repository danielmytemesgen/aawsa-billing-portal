# Notification System — AAWSA Billing Portal

## Overview

The notification system is designed to alert staff and customers at key billing lifecycle events. It is implemented as a unified `notify()` function that dispatches to one or more channels (email, in-app) based on configuration.

> [!IMPORTANT]
> **Email and SMS require additional setup.** An SMTP server or third-party provider must be configured before email notifications will work. See the configuration section below.

---

## Notification Events

| Event | Who is Notified | Channel |
|---|---|---|
| Bill generated | Assigned staff | In-app |
| Payment confirmed | Customer (if email on file) | Email |
| Bill corrected | Admin + Branch Supervisor | In-app |
| Ticket escalated | Assigned staff | In-app + Email |
| Password changed | Staff member | In-app |
| Session revoked by admin | Staff member | In-app |

---

## In-App Notifications (Already Active)

In-app notifications are stored in the `notifications` table and displayed in the portal. These work out of the box — no extra configuration needed.

```sql
-- View recent notifications
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20;
```

---

## Email Notifications (Setup Required)

### Option A: Gmail SMTP (Development / Small Scale)
Add to `.env.production`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-aawsa-email@gmail.com
SMTP_PASS=your-app-password   # Use Gmail App Password, not your account password
SMTP_FROM=AAWSA Billing <billing@aawsa.et>
```

### Option B: Resend (Recommended for Production)
```env
RESEND_API_KEY=re_xxxxxxxxxxxx
SMTP_FROM=billing@aawsa.et
```

### Option C: Local SMTP (Postfix on Server)
```env
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_FROM=billing@aawsa.et
```

---

## SMS Notifications (Optional)

### Africa's Talking (Recommended for Ethiopia)
```env
AT_API_KEY=your-africas-talking-api-key
AT_USERNAME=your-username
AT_SENDER_ID=AAWSA
```

### Twilio (Alternative)
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your-token
TWILIO_FROM=+1234567890
```

---

## Implementation Plan

When ready to implement email/SMS:

1. Create `src/lib/notifications/email.ts` — Nodemailer SMTP sender
2. Create `src/lib/notifications/sms.ts` — Africa's Talking / Twilio adapter
3. Create `src/lib/notifications/index.ts` — unified `notify()` dispatcher
4. Integrate `notify()` calls in `actions.ts` at payment creation and bill approval

---

## Implementation Files

| File | Purpose |
|---|---|
| In-app: `src/lib/db-queries.ts` | `dbCreateNotification()` |
| Future: `src/lib/notifications/email.ts` | Email sender (to be created) |
| Future: `src/lib/notifications/sms.ts` | SMS sender (to be created) |
