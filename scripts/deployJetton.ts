import { toNano } from 'ton-core';
import { Jetton } from '../wrappers/Jetton';
import { compile, sleep } from '@ton-community/blueprint';
import { RunParameter } from './utils/types';
import { initData } from '../wrappers/Jetton.util';

export async function run(p: RunParameter) {
    const code = await compile('Jetton');
    const walletCode = await compile('JettonWallet');
    const jetton = p.provider.open(
        Jetton.createFromData(
            initData(p.wallet.address, walletCode),
            code,
        )
    );

    const seqno = await p.wallet.getSeqno();

    await jetton.sendDeploy(p.sender, toNano('0.05'));

    let currentSeqno = seqno;
    while (currentSeqno == seqno) {
        console.log('waiting for deploy transaction to confirm...');
        await sleep(1500);
        currentSeqno = await p.wallet.getSeqno();
    }
    console.log('Deploy Address:', jetton.address.toString());
    console.log('deploy transaction confirmed!');

    return jetton.address.toString();
}
