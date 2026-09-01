import { getBaseUrl } from './serverUrl';
import type { PredictRequestBody, PredictResponseBody } from './types';

/** Calls the Python ML function (api/predict.py) from server-side code. */
export async function runPrediction(body: PredictRequestBody): Promise<PredictResponseBody> {
  const url = `${getBaseUrl()}/api/predict`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `Prediction engine returned HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      // Our own api/predict.py always sends { error: "a string" }. But if
      // Vercel's platform intercepts the request before our handler code
      // even runs (a crashed/timed-out/failed-to-build Python function),
      // it returns its own error shape instead — typically an object like
      // { code: "FUNCTION_INVOCATION_FAILED", message: "..." } rather than
      // a plain string. Handle both so a platform-level failure shows a
      // real message instead of the value coercing to the literal text
      // "[object Object]" when passed into `new Error(...)` below.
      if (typeof errBody?.error === 'string') {
        message = errBody.error;
      } else if (errBody?.error?.message) {
        message = String(errBody.error.message);
      } else if (errBody?.error) {
        message = JSON.stringify(errBody.error);
      }
    } catch {
      /* ignore parse failure, use default message */
    }
    throw new Error(message);
  }

  return (await res.json()) as PredictResponseBody;
}
