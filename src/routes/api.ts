// src/routes/api.ts
import type { Context } from 'hono';
import { getEVMBlockByTimestamp, getSolanaBlockByTimestamp } from '../utils/block-fetcher';

const cache: Record<string, Record<string, number>> = {};

export async function handleApiRoute(c: Context) {
  const timestampsParam = c.req.query('timestamps');
  const chain = c.req.query('chain') || 'evm';

  if (!timestampsParam) {
    return c.json({ error: 'No timestamps provided' }, 400);
  }

  const timestamps = timestampsParam.split(',').map(ts => ts.trim());
  const results: Record<string, number | null> = {};

  for (const timestamp of timestamps) {
    if (cache[chain] && cache[chain][timestamp]) {
      // Use cached block number if available
      results[timestamp] = cache[chain][timestamp];
    } else {
      // Fetch the block number for this timestamp
      let blockNumber;
      try {
        if (chain === 'solana') {
          blockNumber = await getSolanaBlockByTimestamp(Number(timestamp));
        } else {
          blockNumber = await getEVMBlockByTimestamp(Number(timestamp));
        }

        // Store in cache
        if (!cache[chain]) cache[chain] = {};
        cache[chain][timestamp] = blockNumber;
        results[timestamp] = blockNumber;
      } catch (err) {
        console.error(`Failed to fetch block for timestamp ${timestamp} on chain ${chain}`, err);
        results[timestamp] = null;
      }
    }
  }

  return c.json(results);
}
