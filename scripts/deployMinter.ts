import { Address, beginCell, toNano } from 'ton-core';
import { Minter } from '../wrappers/Minter';
import { compile, sleep } from '@ton-community/blueprint';
import { RunParameter } from './utils/types';

export async function run(p: RunParameter) {
    const jettonAddress = '0x';
    const code = await compile('Minter');
    const minter = p.provider.open(
        Minter.createFromData(
            beginCell()
            .storeAddress(Address.parse(jettonAddress))
            .endCell(),
            code,
        )
    );

    const seqno = await p.wallet.getSeqno();

    await minter.sendDeploy(p.sender, toNano('0.05'));

    let currentSeqno = seqno;
    while (currentSeqno == seqno) {
        console.log('waiting for deploy transaction to confirm...');
        await sleep(1500);
        currentSeqno = await p.wallet.getSeqno();
    }
    console.log('Deploy Address:', minter.address.toString());
    console.log('deploy transaction confirmed!');

    return minter.address.toString();
}
