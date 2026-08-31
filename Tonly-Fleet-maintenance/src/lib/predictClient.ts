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
      if (errBody?.error) message = errBody.error;
    } catch {
      /* ignore parse failure, use default message */
    }
    throw new Error(message);
  }

  return (await res.json()) as PredictResponseBody;
}
