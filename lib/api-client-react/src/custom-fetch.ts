export type ErrorType<T> = T;
export type BodyType<T> = T;
export type AuthTokenGetter = () => string | undefined | Promise<string | undefined>;

let baseUrl = '';
let authTokenGetter: AuthTokenGetter | undefined;

export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/+$/, '');
}

export function setAuthTokenGetter(getter: AuthTokenGetter | undefined) {
  authTokenGetter = getter;
}

export async function customFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const requestUrl =
    typeof input === 'string' && input.startsWith('/')
      ? `${baseUrl}${input}`
      : input;
  const headers = new Headers(init?.headers);
  const authToken = await authTokenGetter?.();
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const response = await fetch(requestUrl, { ...init, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${response.status}`;
    const error = new Error(message) as Error & { error?: string };
    if (typeof body === 'object' && body !== null && 'error' in body) {
      error.error = typeof body.error === 'string' ? body.error : undefined;
    }
    throw error;
  }

  return body as T;
}