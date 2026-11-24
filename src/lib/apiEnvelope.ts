export interface ApiResponseEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
}

export function validateEnvelope<T>(res: any): T {
  if (!res || typeof res !== 'object') {
    throw new Error('Invalid API response format');
  }
  if (typeof res.statusCode !== 'number' || res.statusCode >= 400) {
    throw new Error(res.message || 'API request returned an error status');
  }
  if (!('data' in res)) {
    throw new Error('API response missing data envelope');
  }
  return res.data;
}
