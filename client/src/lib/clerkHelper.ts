/**
 * Bridges Clerk's React session token into the Axios interceptor,
 * which cannot use React hooks directly.
 */

type GetTokenFn = () => Promise<string | null>;

let _getToken: GetTokenFn | null = null;

export function registerClerkGetToken(fn: GetTokenFn) {
  _getToken = fn;
}

export async function getClerkToken(): Promise<string | null> {
  if (!_getToken) return null;
  try {
    return await _getToken();
  } catch {
    return null;
  }
}
