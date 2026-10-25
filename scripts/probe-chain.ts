import { createPublicClient, http, isAddress, keccak256, zeroAddress } from 'viem';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dojang, dojangScrollAbi, giwaSepolia } from '../packages/chain-config/giwa.ts';

const args = process.argv.slice(2);
function option(name: string) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Missing option value');
  return args[index + 1];
}

let stage = 'configuration';
try {
  const wallet = option('--address') ?? zeroAddress;
  if (!isAddress(wallet, { strict: false })) throw new Error('Invalid address');
  const rpcUrl = process.env.GIWA_RPC_URL ?? giwaSepolia.rpcUrls.default.http[0];
  const client = createPublicClient({ chain: giwaSepolia, transport: http(rpcUrl, {
    timeout: 8_000, retryCount: 1,
  }) });
  stage = 'chain-id';
  const chainId = await client.getChainId();
  if (chainId !== giwaSepolia.id) throw new Error('Wrong chain');
  const headBlockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const safeBlock = await client.getBlock({ blockTag: 'safe' });
  const blockNumber = safeBlock.number;
  if (blockNumber === null) throw new Error('Safe block unavailable');
  stage = 'contract-bytecode';
  const [scrollCode, easCode] = await Promise.all([
    client.getCode({ address: dojang.scroll, blockNumber }),
    client.getCode({ address: dojang.eas, blockNumber }),
  ]);
  if (!scrollCode || scrollCode === '0x' || !easCode || easCode === '0x') {
    throw new Error('Required contract not deployed');
  }
  stage = 'dojang-read';
  const verified = await client.readContract({ address: dojang.scroll, abi: dojangScrollAbi,
    functionName: 'isVerified', args: [wallet, dojang.faucetAttester], blockNumber });
  // The official UID getter verifies validity and reverts for an unverified account.
  const uid = verified ? await client.readContract({ address: dojang.scroll, abi: dojangScrollAbi,
    functionName: 'getVerifiedAddressAttestationUid', args: [wallet, dojang.faucetAttester], blockNumber }) : null;
  if (uid !== null && BigInt(uid) === 0n) throw new Error('Inconsistent attestation result');
  const finality = await Promise.allSettled([
    client.getBlock({ blockTag: 'safe' }), client.getBlock({ blockTag: 'finalized' }),
  ]);
  const report = {
    status: 'PASS', checkedAt: new Date().toISOString(), mode: 'READ_ONLY_TESTNET',
    rpcHost: new URL(rpcUrl).hostname, chainId, blockNumber: blockNumber.toString(),
    headBlockNumber: headBlockNumber.toString(), blockTag: 'safe',
    contracts: {
      DojangScroll: { address: dojang.scroll, bytes: (scrollCode.length - 2) / 2, observedCodeHash: keccak256(scrollCode) },
      EAS: { address: dojang.eas, bytes: (easCode.length - 2) / 2, observedCodeHash: keccak256(easCode) },
    },
    walletCheck: {
      address: wallet, isZeroAddressNegativeControl: wallet.toLowerCase() === zeroAddress,
      attester: 'TESTNET FAUCET', attesterId: dojang.faucetAttester,
      verified, attestationUid: uid,
      status: verified ? 'VERIFIED_TESTNET' : 'NOT_VERIFIED',
      disclaimer: 'No identity verification or investment eligibility is implied.',
    },
    finality: Object.fromEntries(finality.map((result, i) => [i === 0 ? 'safe' : 'finalized',
      result.status === 'fulfilled' ? { supported: true, blockNumber: result.value.number?.toString() }
        : { supported: false }])),
    transactionsSent: 0,
  };
  const output = option('--output');
  if (output) {
    const path = resolve(output);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', stage,
    errorType: error instanceof Error ? error.name : 'UnknownError',
    message: 'Probe failed. Check endpoint connectivity, chain ID and official contract deployment.',
  }));
  process.exitCode = 1;
}
