import axios from "axios";

const EVM_RPC_URL =
  "https://mainnet.infura.io/v3/d329f1cc50934c01ae4f89c0662b71b4";
const SOLANA_RPC_URL =
  "https://solana-mainnet.g.alchemy.com/v2/bAe1SR58rtVmDbeol7FUMnPCZbvqi5WZ";

// Cache for slot times and block timestamps
const slotTimeCache: Record<number, number> = {};
const blockTimestampCache: Record<number, number> = {};

// Helper function for delaying execution
async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry function to handle transient errors
async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt >= retries) throw error;
      await delay(delayMs);
    }
  }
  throw new Error("Max retries reached");
}

// Function to get block number for EVM by timestamp
export async function getEVMBlockByTimestamp(
  timestamp: number
): Promise<number> {
  const latestBlock = await getLatestBlockNumber();

  let startBlock = 0;
  let endBlock = latestBlock;
  let closestBlock = 0;
  let closestTimeDifference = Number.MAX_SAFE_INTEGER;

  // Binary search to find the closest block
  while (startBlock <= endBlock) {
    const middleBlock = Math.floor((startBlock + endBlock) / 2);
    const middleBlockTime = await getBlockTimestamp(middleBlock);

    const timeDifference = Math.abs(middleBlockTime - timestamp);
    if (timeDifference < closestTimeDifference) {
      closestBlock = middleBlock;
      closestTimeDifference = timeDifference;
    }

    if (middleBlockTime === timestamp) {
      return middleBlock;
    } else if (middleBlockTime < timestamp) {
      startBlock = middleBlock + 1;
    } else {
      endBlock = middleBlock - 1;
    }
  }

  closestBlock = await refineBlockSearch(closestBlock, timestamp);
  return closestBlock;
}

// Function to refine block search
async function refineBlockSearch(
  initialBlock: number,
  targetTimestamp: number
): Promise<number> {
  let closestBlock = initialBlock;
  let closestTimeDifference = Math.abs(
    (await getBlockTimestamp(initialBlock)) - targetTimestamp
  );

  for (let offset = 1; offset <= 100; offset++) {
    const forwardBlock = initialBlock + offset;
    const backwardBlock = initialBlock - offset;

    const forwardTime = await getBlockTimestamp(forwardBlock);
    const forwardDifference = Math.abs(forwardTime - targetTimestamp);
    if (forwardDifference < closestTimeDifference) {
      closestBlock = forwardBlock;
      closestTimeDifference = forwardDifference;
    }

    const backwardTime = await getBlockTimestamp(backwardBlock);
    const backwardDifference = Math.abs(backwardTime - targetTimestamp);
    if (backwardDifference < closestTimeDifference) {
      closestBlock = backwardBlock;
      closestTimeDifference = backwardDifference;
    }

    if (closestTimeDifference <= 60) {
      break;
    }
  }

  return closestBlock;
}

// Function to get block timestamp for EVM with caching
async function getBlockTimestamp(blockNumber: number): Promise<number> {
  return retry(async () => {
    if (blockNumber in blockTimestampCache) {
      return blockTimestampCache[blockNumber];
    }

    const response = await axios.post(EVM_RPC_URL, {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: [`0x${blockNumber.toString(16)}`, false],
      id: 1,
    });

    if (!response.data.result) {
      throw new Error(`No data found for block number: ${blockNumber}`);
    }

    const timestamp = parseInt(response.data.result.timestamp, 16);
    blockTimestampCache[blockNumber] = timestamp;
    return timestamp;
  });
}

// Function to get the latest block number
async function getLatestBlockNumber(): Promise<number> {
  const response = await axios.post(EVM_RPC_URL, {
    jsonrpc: "2.0",
    method: "eth_blockNumber",
    params: [],
    id: 1,
  });
  return parseInt(response.data.result, 16);
}

// New function to get timestamp by block number
export async function getTimestampByBlockNumber(
  blockNumber: number
): Promise<number> {
  return getBlockTimestamp(blockNumber);
}

// Function to get block number for Solana by timestamp
export async function getSolanaBlockByTimestamp(
  timestamp: number
): Promise<number> {
  const latestSlot = await getLatestSlot();
  const genesisTimestamp = await getCachedSlotTime(0);
  if (timestamp <= genesisTimestamp) {
    return 0;
  }

  let startSlot = 0;
  let endSlot = latestSlot;
  let closestSlot = 0;
  let closestTimeDifference = Number.MAX_SAFE_INTEGER;

  while (startSlot <= endSlot) {
    const middleSlot = Math.floor((startSlot + endSlot) / 2);
    const middleSlotTime = await getCachedSlotTime(middleSlot);

    const timeDifference = Math.abs(middleSlotTime - timestamp);
    if (timeDifference < closestTimeDifference) {
      closestSlot = middleSlot;
      closestTimeDifference = timeDifference;
    }

    if (middleSlotTime === timestamp) {
      return middleSlot;
    } else if (middleSlotTime < timestamp) {
      startSlot = middleSlot + 1;
    } else {
      endSlot = middleSlot - 1;
    }
  }

  closestSlot = await refineSlotSearch(closestSlot, timestamp);
  return closestSlot;
}

// Function to refine slot search for Solana
async function refineSlotSearch(
  initialSlot: number,
  targetTimestamp: number
): Promise<number> {
  let closestSlot = initialSlot;
  let closestTimeDifference = Math.abs(
    (await getCachedSlotTime(initialSlot)) - targetTimestamp
  );

  for (let offset = 1; offset <= 100; offset++) {
    const forwardSlot = initialSlot + offset;
    const backwardSlot = initialSlot - offset;

    const forwardTime = await getCachedSlotTime(forwardSlot);
    const forwardDifference = Math.abs(forwardTime - targetTimestamp);
    if (forwardDifference < closestTimeDifference) {
      closestSlot = forwardSlot;
      closestTimeDifference = forwardDifference;
    }

    const backwardTime = await getCachedSlotTime(backwardSlot);
    const backwardDifference = Math.abs(backwardTime - targetTimestamp);
    if (backwardDifference < closestTimeDifference) {
      closestSlot = backwardSlot;
      closestTimeDifference = backwardDifference;
    }

    if (closestTimeDifference <= 60) {
      break;
    }
  }

  return closestSlot;
}

// Function for cached slot time retrieval
async function getCachedSlotTime(slot: number): Promise<number> {
  return retry(async () => {
    if (slot in slotTimeCache) {
      return slotTimeCache[slot];
    }

    const slotTime = await getSlotTime(slot);
    slotTimeCache[slot] = slotTime;
    return slotTime;
  });
}

// Function to get the latest slot number
async function getLatestSlot(): Promise<number> {
  const response = await axios.post(SOLANA_RPC_URL, {
    jsonrpc: "2.0",
    method: "getSlot",
    params: [],
    id: 1,
  });
  return response.data.result;
}

// Function to get slot time from Solana
async function getSlotTime(slot: number): Promise<number> {
  const response = await axios.post(SOLANA_RPC_URL, {
    jsonrpc: "2.0",
    method: "getBlockTime",
    params: [slot],
    id: 1,
  });

  console.log(`Fetching timestamp for slot: ${slot}, Response:`, response.data);

  if (response.data.result === null) {
    throw new Error(`No timestamp found for slot ${slot}`);
  }

  return response.data.result;
}

// Function to get timestamp by slot number
export async function getTimestampBySlot(slot: number): Promise<number> {
  const latestSlot = await getLatestSlot();
  console.log(`Latest Slot: ${latestSlot}`);

  if (slot < 0 || slot > latestSlot) {
    throw new Error(
      `Slot ${slot} is out of range. Latest slot is ${latestSlot}.`
    );
  }

  return getCachedSlotTime(slot);
}
