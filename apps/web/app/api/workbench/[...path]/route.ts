import { coreRequest } from '../../../../lib/core';
type Context = {params: Promise<{path: string[]}>};
async function proxy(request: Request, context: Context) {
  const {path} = await context.params;
  if (path.length > 4 || path.some(segment => !/^[a-z0-9-]+$/.test(segment))) return Response.json({code:'NOT_FOUND'},{status:404});
  return coreRequest(`/api/v1/workbench/${path.join('/')}`,request);
}
export const GET=proxy;
export const POST=proxy;
