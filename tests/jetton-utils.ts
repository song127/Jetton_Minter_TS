import BN from "bn.js";
import { Address, Slice } from "ton";

export function getWalletAddress(stack: any[]): Address {
  return stack[0][1].bytes[0].beginParse().readAddress()!;
}

interface JettonWalletDetails {
  balance: BN;
  owner: Address;
  jettonMasterContract: Address; // Minter
}

export function parseJettonWalletDetails(execResult: { result: any[] }): JettonWalletDetails {
  return {
    balance: execResult.result[0] as BN,
    owner: (execResult.result[1] as Slice).loadAddress()!,
    jettonMasterContract: (execResult.result[2] as Slice).loadAddress()!,
  };
}
