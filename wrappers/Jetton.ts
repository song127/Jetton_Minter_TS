import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano,
} from 'ton-core';
import { OPS } from './Jetton.ops';

export class Jetton implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Jetton(address);
    }

    static createFromData(data: Cell, code: Cell, workchain = 0) {
        const init = { code, data };
        return new Jetton(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        opts: {
            amount: bigint;
            to: Address;
        }
    ) {
        await provider.internal(via, {
            value: toNano('0.05'), // fee with gas
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            bounce: true,
            body: beginCell()
                .storeUint(OPS.Mint, 32) // opcode (reference TODO)
                .storeUint(0, 64) // queryid
                .storeAddress(opts.to)
                .storeCoins(toNano('0.02')) // gas fee
                .storeRef(
                    // internal transfer message
                    beginCell()
                        .storeUint(OPS.InternalTransfer, 32)
                        .storeUint(0, 64)
                        .storeCoins(opts.amount)
                        .storeAddress(null) // TODO FROM?
                        .storeAddress(null) // TODO RESP?
                        .storeCoins(0)
                        .storeBit(false) // forward_payload in this slice, not separate cell
                        .endCell()
                )
                .endCell(),
        });
    }

    async getWalletAddress(provider: ContractProvider, forTonWalletAddress: Address) {
        const result = await provider.get('get_wallet_address', [
            {
                type: 'slice',
                cell: beginCell().storeAddress(forTonWalletAddress).endCell(),
            },
        ]);
        return result.stack.readAddress();
    }

    async getJettonDatas(provider: ContractProvider) {
        // (total_supply, -1, owner_address, content(metadata), jetton_wallet_code)
        const result = await provider.get('get_jetton_data', []);
        return result.stack;
    }

    async getTestDatas(provider: ContractProvider) {
        // (total_supply, -1, owner_address, content(metadata), jetton_wallet_code)
        const result = await provider.get('get_test', []);
        return result.stack;
    }
}
