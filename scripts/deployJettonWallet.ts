import { toNano, Address } from 'ton-core';
import { compile, sleep } from '@ton-community/blueprint';
import { RunParameter } from './utils/types';
import { walletInitData } from '../wrappers/Jetton.util';
import { JettonWalletContract } from '../wrappers/JettonWallet';

export async function run(p: RunParameter, userAddress: Address, jettonAddress: Address) {
    const code = await compile('JettonWallet');
    const jettonWallet = p.provider.open(
        JettonWalletContract.createFromData(
            walletInitData(userAddress, jettonAddress, code),
            code,
        )
    );

    const seqno = await p.wallet.getSeqno();

    await jettonWallet.sendDeploy(p.sender, toNano('0.05'));

    let currentSeqno = seqno;
    while (currentSeqno == seqno) {
        console.log('waiting for deploy transaction to confirm...');
        await sleep(1000);
        currentSeqno = await p.wallet.getSeqno();
    }
    console.log('Deploy Address:', jettonWallet.address.toString());
    console.log('deploy transaction confirmed!');

    return jettonWallet.address.toString();
}
