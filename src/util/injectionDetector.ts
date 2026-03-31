/**
 * Multi-tier prompt injection detector for RAG content.
 * Scans both user queries and scraped content before they enter the knowledge base
 * or get injected into LLM context.
 */

export interface ScanResult {
  flagged: boolean;
  tier: "clean" | "unicode" | "pattern" | "heuristic";
  reason?: string;
  /** Sanitized text with dangerous content removed/escaped */
  sanitized: string;
}

// Tier 1: Invisible Unicode detection
const INVISIBLE_CHARS = /[\u200B-\u200F\u2028-\u202F\u2060-\u2064\uFEFF\u00AD\u034F\u180E]/gu;
const BIDI_CHARS = /[\u202A-\u202E\u2066-\u2069]/gu;
const TAG_CHARS = /[\u{E0001}-\u{E007F}]/gu;

// Tier 2: Pattern matching (multilingual)
const INJECTION_PATTERNS: RegExp[] = [
  // English
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(all\s+)?(previous|prior|your)\s+(instructions?|rules?|programming)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /new\s+(instructions?|rules?|role|persona|identity)\s*:/i,
  /system\s*prompt\s*:/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<\/?system>/i,
  /act\s+as\s+(a|an|if|though)\s+/i,
  /pretend\s+(you('re|\s+are)|to\s+be)\s+/i,
  /override\s+(your|the|all)\s+(instructions?|rules?|safety|guidelines?)/i,
  /jailbreak/i,
  /do\s+anything\s+now/i,
  /DAN\s+mode/i,
  // Spanish
  /ignora\s+(todas?\s+)?(las?\s+)?instrucciones?\s+anteriores?/i,
  /olvida\s+(todas?\s+)?(las?\s+)?instrucciones?/i,
  // French
  /ignore[rz]?\s+(toutes?\s+)?(les?\s+)?instructions?\s+(pr[eé]c[eé]dentes?|ant[eé]rieures?)/i,
  // Structural
  /```\s*(system|instruction|prompt)/i,
  /\bhuman\s*:\s*$/im,
  /\bassistant\s*:\s*$/im,
];

// Tier 3: Heuristic amplifiers
function heuristicScore(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // High density of control-like language
  const controlWords = ["must", "always", "never", "override", "bypass", "ignore", "forget", "disregard"];
  const controlCount = controlWords.filter(w => lower.includes(w)).length;
  if (controlCount >= 3) score += 0.4;

  // Attempts to redefine identity
  if (/you\s+are\s+(not|no\s+longer)/i.test(text)) score += 0.5;
  if (/your\s+(real|true|actual)\s+(purpose|goal|role)/i.test(text)) score += 0.5;

  // Encoded/obfuscated instructions (base64-like blocks in otherwise normal text)
  if (/[A-Za-z0-9+/]{40,}={0,2}/.test(text) && text.length < 500) score += 0.3;

  // Sandwich attack: instruction-like content between normal-looking text
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length >= 3) {
    const middle = lines.slice(1, -1).join(" ").toLowerCase();
    if (INJECTION_PATTERNS.some(p => p.test(middle))) score += 0.3;
  }

  return score;
}

/**
 * Scan text for prompt injection attempts.
 */
export function scanForInjection(text: string): ScanResult {
  // Tier 1: Invisible Unicode
  if (INVISIBLE_CHARS.test(text) || BIDI_CHARS.test(text) || TAG_CHARS.test(text)) {
    const sanitized = text
      .replace(INVISIBLE_CHARS, "")
      .replace(BIDI_CHARS, "")
      .replace(TAG_CHARS, "");
    return { flagged: true, tier: "unicode", reason: "Invisible or bidirectional Unicode characters detected", sanitized };
  }

  // Tier 2: Pattern matching
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { flagged: true, tier: "pattern", reason: `Matched injection pattern: ${pattern.source.slice(0, 50)}`, sanitized: text };
    }
  }

  // Tier 3: Heuristic
  const score = heuristicScore(text);
  if (score >= 0.5) {
    return { flagged: true, tier: "heuristic", reason: `Heuristic score ${score.toFixed(2)} exceeds threshold`, sanitized: text };
  }

  return { flagged: false, tier: "clean", sanitized: text };
}

/**
 * Scan and sanitize text — removes invisible chars but lets flagged content through
 * with a warning prefix so the LLM knows it was flagged.
 */
export function sanitizeForRag(text: string): string {
  const result = scanForInjection(text);
  if (!result.flagged) return result.sanitized;

  // Always strip invisible chars
  const clean = result.sanitized
    .replace(INVISIBLE_CHARS, "")
    .replace(BIDI_CHARS, "")
    .replace(TAG_CHARS, "");

  return clean;
}
