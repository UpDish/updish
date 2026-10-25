import { coreRequest } from '../../../../lib/core';

type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  if (!['csrf', 'session'].includes(action)) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  return coreRequest(`/api/v1/auth/${action}`, request);
}
export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  if (!['challenge', 'verify', 'logout'].includes(action)) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  return coreRequest(`/api/v1/auth/${action}`, request);
}
