/**
 * Minimal sanitization helpers to reduce XSS surface for user-controlled strings.
 * Note: server-side validation and XSS prevention (CSP, escaping) are primary defenses.
 */
export function sanitizeHtml(input: string | null | undefined) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}
