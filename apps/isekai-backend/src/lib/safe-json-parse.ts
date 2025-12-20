/**
 * Safe JSON parser that won't crash the application on invalid JSON
 * Returns a fallback value if parsing fails
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    // Silently return fallback on parse error
    return fallback;
  }
}

/**
 * Safe JSON parser with error logging
 * Returns a fallback value if parsing fails and logs the error
 */
export function safeJsonParseWithLog<T>(json: string, fallback: T, context?: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error(`[JSON Parse Error] ${context || 'Unknown context'}:`, error);
    return fallback;
  }
}
