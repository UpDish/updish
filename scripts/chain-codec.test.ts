import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { encodeFunctionData, toFunctionSelector } from 'viem';
import { dojang, dojangScrollAbi } from '../packages/chain-config/giwa.ts';

test('Java adapter selectors and official viem ABI agree', async () => {
  const source = await readFile(new URL('../services/core-api/src/main/java/io/updish/core/chain/DojangCodec.java', import.meta.url), 'utf8');
  for (const signature of ['isVerified(address,bytes32)', 'getVerifiedAddressAttestationUid(address,bytes32)']) {
    assert.ok(source.includes(toFunctionSelector(signature)), `Missing selector for ${signature}`);
  }
  assert.ok(source.includes(dojang.faucetAttester));
  const call = encodeFunctionData({ abi: dojangScrollAbi, functionName: 'isVerified',
    args: ['0x0000000000000000000000000000000000000001', dojang.faucetAttester] });
  assert.equal(call, `0xba03e205${'0'.repeat(63)}1${dojang.faucetAttester.slice(2)}`);
});
