import type { Context } from 'hono';
import { getEVMBlockByTimestamp, getSolanaBlockByTimestamp, getTimestampByBlockNumber } from '../utils/block-fetcher';

const cache: Record<string, Record<string, number>> = {};

export async function handleApiRoute(c: Context) {
  const timestampsParam = c.req.query('timestamps');
  const blockNumberParam = c.req.query('blockNumber');
  const chain = c.req.query('chain') || 'evm';
  const results: Record<string, number | null> = {};

  if (timestampsParam) {
    const timestamps = timestampsParam.split(',').map(ts => ts.trim());
    for (const timestamp of timestamps) {
      if (cache[chain] && cache[chain][timestamp]) {
        results[timestamp] = cache[chain][timestamp];
      } else {
        let blockNumber;
        try {
          if (chain === 'solana') {
            blockNumber = await getSolanaBlockByTimestamp(Number(timestamp));
          } else {
            blockNumber = await getEVMBlockByTimestamp(Number(timestamp));
          }

          if (!cache[chain]) cache[chain] = {};
          cache[chain][timestamp] = blockNumber;
          results[timestamp] = blockNumber;
        } catch (err: any) { // Use 'any' to avoid 'unknown' type issues
          console.error(`Failed to fetch block for timestamp ${timestamp} on chain ${chain}`, err);
          results[timestamp] = null;
        }
      }
    }
  } else if (blockNumberParam) {
    try {
      const blockNumber = Number(blockNumberParam);
      const timestamp = await getTimestampByBlockNumber(blockNumber);
      results[blockNumberParam] = timestamp;
    } catch (error: any) { // Use 'any' to handle the error
      return c.text(`Error fetching timestamp: ${error.message}`, 500);
    }
  } else {
    return c.json({ error: 'No timestamps or block number provided' }, 400);
  }

  return c.json(results);
}
