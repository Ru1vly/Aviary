/**
 * Canonical word tokenizer for keyword/content analysis, replacing three definitions
 * that used to disagree across content.ts (all words), urlFactors.ts (len>3), and
 * spamDetection.ts (lowercased, len>3) — each fed different word sets into different
 * scoring logic. Confirmed with the user: lowercased + drop tokens of length <= 4
 * (i.e. keep length > 3) is the canonical definition going forward.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);
}
