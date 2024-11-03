// src/utils/block-fetcher.ts
import axios from "axios";

const EVM_RPC_URL =
  "https://mainnet.infura.io/v3/d329f1cc50934c01ae4f89c0662b71b4";
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

export async function getEVMBlockByTimestamp(
  timestamp: number
): Promise<number> {
  const blockNumber = await binarySearchBlockForEVM(timestamp);
  return blockNumber;
}

async function binarySearchBlockForEVM(
  targetTimestamp: number
): Promise<number> {
  let startBlock = 0;
  let endBlock = await getLatestBlockNumber();

  while (startBlock <= endBlock) {
    const middleBlock = Math.floor((startBlock + endBlock) / 2);
    console.log(
      `Searching between blocks ${startBlock} and ${endBlock}, middle block: ${middleBlock}`
    );

    try {
      // Użyj formatu heksadecymalnego z "0x"
      const middleBlockData = await axios.post(EVM_RPC_URL, {
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: [`0x${middleBlock.toString(16)}`, false], // Dodanie "0x" na początku
        id: 1,
      });

      console.log(`Block data for ${middleBlock}:`, middleBlockData.data);

      if (!middleBlockData.data.result) {
        console.error(`No data found for block number: ${middleBlock}`);
        return startBlock; // lub obsłuż błąd inaczej
      }

      const middleBlockTimestamp = parseInt(
        middleBlockData.data.result.timestamp,
        16
      );
      if (middleBlockTimestamp === targetTimestamp) {
        return middleBlock;
      } else if (middleBlockTimestamp < targetTimestamp) {
        startBlock = middleBlock + 1;
      } else {
        endBlock = middleBlock - 1;
      }
    } catch (error) {
      console.error(`Error fetching block ${middleBlock}:`, error);
      return startBlock; // lub obsłuż błąd inaczej
    }
  }

  return startBlock - 1;
}

async function getLatestBlockNumber(): Promise<number> {
  const response = await axios.post(EVM_RPC_URL, {
    jsonrpc: "2.0",
    method: "eth_blockNumber",
    params: [],
    id: 1,
  });
  return parseInt(response.data.result, 16);
}

export async function getSolanaBlockByTimestamp(
  timestamp: number
): Promise<number> {
  const latestSlot = await getLatestSlot();

  let startSlot = 0;
  let endSlot = latestSlot;

  while (startSlot <= endSlot) {
    const middleSlot = Math.floor((startSlot + endSlot) / 2);
    const middleSlotTime = await getSlotTime(middleSlot);

    if (middleSlotTime === timestamp) {
      return middleSlot;
    } else if (middleSlotTime < timestamp) {
      startSlot = middleSlot + 1;
    } else {
      endSlot = middleSlot - 1;
    }
  }

  return startSlot;
}

async function getLatestSlot(): Promise<number> {
  const response = await axios.post(SOLANA_RPC_URL, {
    jsonrpc: "2.0",
    method: "getSlot",
    params: [],
    id: 1,
  });
  return response.data.result;
}

async function getSlotTime(slot: number): Promise<number> {
  const response = await axios.post(SOLANA_RPC_URL, {
    jsonrpc: "2.0",
    method: "getBlockTime",
    params: [slot],
    id: 1,
  });
  return response.data.result;
}
