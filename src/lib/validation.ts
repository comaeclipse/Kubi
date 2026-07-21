// Lightweight validation helpers (matching the codebase's manual-validation style).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

// Password rule: at least 8 characters.
export function isValidPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 8;
}

// Blocked-word lists are matched case-insensitively against video titles, so
// they're stored lowercased and de-duplicated. The caps are there to keep one
// profile from turning every content query into hundreds of ILIKE clauses.
export const MAX_BLOCKED_KEYWORDS = 50;
export const MAX_BLOCKED_KEYWORD_LENGTH = 40;

export function normalizeBlockedKeywords(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const word = entry.trim().toLowerCase().slice(0, MAX_BLOCKED_KEYWORD_LENGTH);
    if (word) seen.add(word);
    if (seen.size >= MAX_BLOCKED_KEYWORDS) break;
  }
  return [...seen];
}

// Null clears the limit. Anything outside 5 minutes–24 hours is rejected rather
// than clamped, so a typo surfaces as an error instead of a silent setting.
export const MIN_DAILY_LIMIT_MINUTES = 5;
export const MAX_DAILY_LIMIT_MINUTES = 1440;

export function isValidDailyLimit(value: unknown): value is number | null {
  if (value === null) return true;
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_DAILY_LIMIT_MINUTES &&
    value <= MAX_DAILY_LIMIT_MINUTES
  );
}
