/**
 * Shared error handler for Reveal.
 * Use instead of empty catch blocks.
 */
export function handleError(err, context = 'unknown') {
  console.error(`[Reveal:${context}]`, err?.message || err);
  // Could be extended with Sentry, toast notifications etc.
}

/**
 * For non-critical errors (audio init, animation etc.)
 * Logs as warning, doesn't throw.
 */
export function handleSoftError(err, context = 'unknown') {
  console.warn(`[Reveal:${context}]`, err?.message || err);
}
