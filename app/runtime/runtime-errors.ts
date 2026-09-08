export type RuntimeErrorContext = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

export type RuntimeErrorRecord = Readonly<{
  scope: string;
  message: string;
  context: RuntimeErrorContext;
  timestamp: string;
}>;

const REPORT_THROTTLE_MS = 2_000;
const MAX_RECENT_ERRORS = 12;
const lastReportAt = new Map<string, number>();
const recentErrors: RuntimeErrorRecord[] = [];

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function serializeRuntimeError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: errorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

export function recentRuntimeErrors(): readonly RuntimeErrorRecord[] {
  return recentErrors.map((entry) => ({ ...entry, context: { ...entry.context } }));
}

/**
 * Browser/runtime reporting belongs above the deterministic game boundary.
 * Repeated frame failures are throttled so a broken renderer cannot flood logs.
 */
export function reportRuntimeError(
  scope: string,
  error: unknown,
  context: RuntimeErrorContext = {},
) {
  const message = errorMessage(error);
  const fingerprint = `${scope}:${message}`;
  const now = Date.now();
  if (now - (lastReportAt.get(fingerprint) ?? 0) < REPORT_THROTTLE_MS) return;
  lastReportAt.set(fingerprint, now);
  recentErrors.push({
    scope,
    message,
    context: { ...context },
    timestamp: new Date(now).toISOString(),
  });
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.shift();
  console.error(`[Neon Fare/${scope}] ${message}`, { error, ...context });
}
