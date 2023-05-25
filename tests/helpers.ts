import BN from "bn.js";
import {
  Address,
  Cell,
  CommonMessageInfo,
  WalletContractV4,
  SendMode
} from "ton";
import { SmartContract } from "ton-contract-executor";
import Prando from "prando";

export const zeroAddress = new Address(0, Buffer.alloc(32, 0));

export function randomAddress(seed: string, workchain?: number) {
  const random = new Prando(seed);
  const hash = Buffer.alloc(32);
  for (let i = 0; i < hash.length; i++) {
    hash[i] = random.nextInt(0, 255);
  }
  return new Address(workchain ?? 0, hash);
}

// temp fix until ton-contract-executor (unit tests) remembers c7 value between calls
export function setBalance(contract: SmartContract, balance: bigint) {
  contract.setC7Config({
    balance: balance,
  });
}
