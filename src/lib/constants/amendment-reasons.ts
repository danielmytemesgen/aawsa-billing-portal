export const AMENDMENT_REASONS = [
  "🏷️ Meter Key Mismatch",
  "🏷️ GPS / Location Error",
  "🏷️ Missing Document",
  "🏷️ Wrong Tariff Category",
  "🏷️ Duplicate Record",
  "🏷️ Customer Info Incomplete",
  "🏷️ Other",
] as const;

export type AmendmentReason = (typeof AMENDMENT_REASONS)[number];

