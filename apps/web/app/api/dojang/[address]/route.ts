import { coreGet } from '../../../../lib/core';

export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ code: 'INVALID_ADDRESS', message: '올바른 지갑 주소를 입력해 주세요.' }, { status: 400 });
  }
  return coreGet(`/api/v1/dojang/${address}`);
}
