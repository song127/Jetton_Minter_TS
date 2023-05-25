import { OpenedContract, Sender, TonClient, WalletContractV4 } from "ton";

export type RunParameter = {
    provider: TonClient,
    wallet: OpenedContract<WalletContractV4>,
    sender: Sender,
}

export type JettonMetaDataKeys = 'name' | 'description' | 'image' | 'symbol';