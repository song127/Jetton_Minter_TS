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

export class Minter implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Minter(address);
    }

    static createFromData(data: Cell, code: Cell, workchain = 0) {
        const init = { code, data };
        return new Minter(contractAddress(workchain, init), init);
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
                .storeCoins(toNano('5'))
                .endCell(),
        });
    }
}
