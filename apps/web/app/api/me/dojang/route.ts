import { coreRequest } from '../../../../lib/core';

export async function GET(request: Request) {
  return coreRequest('/api/v1/me/dojang', request);
}
