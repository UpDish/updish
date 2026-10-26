export async function coreGet(path: string): Promise<Response> {
  return coreRequest(path);
}

export async function coreRequest(path: string, request?: Request): Promise<Response> {
  const bodyLimit = path === '/api/v1/workbench/evidence' ? 1_100_000 : 8192;
  const headers = new Headers({ Accept: 'application/json' });
  const method = request?.method ?? 'GET';
  if (request) {
    const session = request.headers.get('cookie')?.split(';').map(value => value.trim())
      .find(value => value.startsWith('UPDISH_SESSION='));
    if (session) headers.set('Cookie', session);
  }
  if (method !== 'GET') {
    const origin = request!.headers.get('origin');
    // Next's request.url may contain the internal listener hostname (0.0.0.0).
    // Bind the explicit public-origin allowlist to the actual Host header instead.
    const allowed = (process.env.UPDISH_ALLOWED_ORIGINS ?? 'http://127.0.0.1:3000,http://localhost:3000').split(',').map(value => value.trim());
    if (!origin || !allowed.includes(origin) || new URL(origin).host !== request!.headers.get('host')) {
      return Response.json({ code: 'ORIGIN_REJECTED', message: '현재 사이트에서 다시 요청해 주세요.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
    headers.set('Origin', origin);
    headers.set('Content-Type', 'application/json');
    const csrf = request!.headers.get('x-csrf-token');
    if (csrf) headers.set('X-CSRF-TOKEN', csrf);
    const length = Number(request!.headers.get('content-length') ?? 0);
    if (length > bodyLimit) return Response.json({ code: 'BODY_TOO_LARGE' }, { status: 413 });
  }
  try {
    const body = method === 'GET' ? undefined : await request!.text();
    if (body && body.length > bodyLimit) return Response.json({ code: 'BODY_TOO_LARGE' }, { status: 413 });
    const response = await fetch(new URL(path, process.env.CORE_API_URL ?? 'http://127.0.0.1:8080'), {
      method, headers, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout((path.endsWith('/explain') || path.endsWith('/agent/chat')) ? 55_000 : 30_000),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      return Response.json({ code: 'INVALID_UPSTREAM_RESPONSE', message: '서버 응답을 확인하지 못했습니다.' }, { status: 502 });
    }
    const outgoing = new Headers({ 'Cache-Control': 'no-store', Vary: 'Cookie' });
    for (const cookie of response.headers.getSetCookie()) outgoing.append('Set-Cookie', cookie);
    return Response.json(await response.json(), { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ code: 'CORE_UNAVAILABLE', message: '업무 서버에 연결하지 못했습니다. 서버 실행 상태를 확인해 주세요.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
