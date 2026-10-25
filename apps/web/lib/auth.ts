export type Session = { authenticated: false } | {
  authenticated: true; user: { id: string; address: string; role: string }; chainId: number;
};
export type Verification = {
  address: string; verified: boolean; attester: string; attestationUid: string | null;
  blockNumber: string; blockTag: string; checkedAt: string;
};
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: 'no-store', credentials: 'same-origin',
    signal: init?.signal ?? AbortSignal.timeout(35_000) });
  const body = await response.json();
  if (!response.ok) throw new ApiError(body.message ?? '요청을 완료하지 못했습니다. 다시 시도해 주세요.', response.status);
  return body as T;
}
export async function authPost<T>(action: string, body: object = {}): Promise<T> {
  // Fetch a fresh token after login/session-ID rotation; tokens never go into localStorage.
  const csrf = await api<{ token: string; headerName: string }>('/api/auth/csrf');
  return api<T>(`/api/auth/${action}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify(body) });
}
