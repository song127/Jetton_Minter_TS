import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from 'ton-core';
import { OPS } from './Jetton.ops';

export class JettonWalletContract implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new JettonWalletContract(address);
    }

    static createFromData(data: Cell, code: Cell, workchain = 0) {
        const init = { code, data };
        return new JettonWalletContract(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(provider: ContractProvider, via: Sender, opts: { amount: bigint; to: Address }) {
        await provider.internal(via, {
            value: toNano('0.05'), // fee with gas
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPS.Transfer, 32) // opcode (reference TODO)
                .storeUint(0, 64) // queryid
                .storeCoins(opts.amount)
                .storeAddress(opts.to)
                .storeAddress(null) // TODO RESP?
                .storeDict(null) // custom payload
                .storeCoins(0) // forward ton amount TODO
                .storeMaybeRef(null) // forward payload - TODO??
                .endCell(),
        });
    }

    async getDetails(provider: ContractProvider) {
        const result = await provider.get('get_wallet_data', []);
        return result.stack;
    }
}
