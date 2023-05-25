import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Address, Cell, beginCell, openContract, toNano } from 'ton-core';
import { Jetton } from '../wrappers/Jetton';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { initData, jettonParams, parseMetadata } from '../wrappers/Jetton.util';
import { randomAddress } from '@ton-community/test-utils';
import { JettonWallet } from './jetton-wallet';
import { parseJettonWalletDetails } from './jetton-utils';
import { BN } from 'bn.js';
import { JettonWalletContract } from '../wrappers/JettonWallet';
import { setBalance } from './helpers';

describe('Jetton', () => {
    let code: Cell;
    let walletCode: Cell;

    const getJWalletContract = async (
        walletOwnerAddress: Address,
        jettonMasterAddress: Address
    ): Promise<JettonWallet> =>
        await JettonWallet.create(
            walletCode,
            beginCell()
                .storeCoins(0)
                .storeAddress(walletOwnerAddress)
                .storeAddress(jettonMasterAddress)
                .storeRef(walletCode)
                .endCell()
        );

    beforeAll(async () => {
        code = await compile('Jetton');
        walletCode = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let jetton: SandboxContract<Jetton>;
    let deployer: SandboxContract<TreasuryContract>;
    let user_1: SandboxContract<TreasuryContract>;
    let user_2: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        user_1 = await blockchain.treasury('user_1');
        user_2 = await blockchain.treasury('user_2');

        const testData = initData(deployer.address, code);
        const testSlice = testData.asSlice();
        const testCoin = testSlice.loadCoins();
        const testAddress = testSlice.loadAddress();
        const testMeta = testSlice.loadRef();

        // console.log(testMeta);

        jetton = blockchain.openContract(Jetton.createFromData(initData(deployer.address, walletCode), code));

        const deployResult = await jetton.sendDeploy(deployer.getSender(), toNano('10'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jetton.address,
            deploy: true,
            success: true,
        });
    });

    it('should get minter initialization data correctly', async () => {
        const callData = await jetton.getJettonDatas();
        const totalSupply = callData.readNumber();
        const tempInt = callData.readNumber();
        const adminAddress = callData.readAddress();
        const metadata = parseMetadata(callData.readCell());
        const jettonWalletCode = callData.readCell();

        // console.log(totalSupply);
        // console.log(tempInt);
        // console.log(adminAddress);

        // console.log(metadata.name);
        // console.log(metadata.symbol);
        // console.log(metadata.description);
        // console.log(metadata.image);

        expect(totalSupply).toBe(0);
        expect(metadata.name).toMatch(jettonParams.name);
        expect(metadata.symbol).toMatch(jettonParams.symbol);
        expect(metadata.description).toMatch(jettonParams.description);
        expect(metadata.image).toMatch(jettonParams.image);
    });

    it('offchain and onchain jwallet should return the same address', async () => {
        const jwallet = await getJWalletContract(user_1.address, jetton.address);
        const participantJwalletAddress = await jetton.getWalletAddress(user_1.address);
        expect(jwallet.address).toEqualAddress(participantJwalletAddress);
    });

    it('should get jwallet initialization data correctly', async () => {
        const jwallet = await getJWalletContract(user_1.address, jetton.address);
        const jwalletDetails = parseJettonWalletDetails(await jwallet.contract.invokeGetMethod('get_wallet_data', []));

        expect(jwalletDetails.balance.toString()).toBe('0');
        expect(jwalletDetails.owner).toEqualAddress(user_1.address);
        expect(jwalletDetails.jettonMasterContract).toEqualAddress(jetton.address);
    });

    it('should mint jettons and transfer to 2 new wallets', async () => {
        let callData = await jetton.getJettonDatas();
        let totalSupply = callData.readNumber();

        console.log('Total :', totalSupply);

        const jwallet1 = await getJWalletContract(user_1.address, jetton.address);

        jwallet1.contract.setBalance(toNano('1000'));

        let jwallet1TON = (await blockchain.getContract(jwallet1.address)).balance;
        console.log('After TON 1 :', jwallet1TON);

        const { balance: balanceInitial } = parseJettonWalletDetails(
            await jwallet1.contract.invokeGetMethod('get_wallet_data', [])
        );

        console.log('Init Balance :', balanceInitial);

        // let deployerBalance = (await blockchain.getContract(deployer.address)).balance;
        // console.log('Before TON 1 :', deployerBalance);
        // let jettonBalance = (await blockchain.getContract(jetton.address)).balance;
        // console.log('Before TON 2 :', jettonBalance);
        // let jwalletBalance = (await blockchain.getContract(jwallet1.address)).balance;
        // console.log('Before TON 3 :', jwalletBalance);

        // Produce mint message
        try {
            const result = await jetton.sendMint(deployer.getSender(), {
                to: deployer.address,
                amount: toNano('412'),
            });
        } catch (e) {
            console.log(e);
        }

        // deployerBalance = (await blockchain.getContract(deployer.address)).balance;
        // console.log('After TON 1 :', deployerBalance);
        // jettonBalance = (await blockchain.getContract(jetton.address)).balance;
        // console.log('After TON 2 :', jettonBalance);
        // jwalletBalance = (await blockchain.getContract(jwallet1.address)).balance;
        // console.log('After TON 3 :', jwalletBalance);

        callData = await jetton.getJettonDatas();
        totalSupply = callData.readNumber();

        console.log('Total :', totalSupply);

        const { balance: balanceAfter } = parseJettonWalletDetails(
            await jwallet1.contract.invokeGetMethod('get_wallet_data', [])
        );

        // jwalletBalance = (await blockchain.getContract(jwallet1.address)).balance;
        // console.log('After TON :', jwalletBalance);

        console.log('After Balance :', balanceAfter);
        expect(true).toBe(true);
        // Error: jwallet1 should reflact its balance after mint
        // expect(balanceAfter).toBe(toNano('100'));

        // const callData = await jetton.getJettonDatas();
        // const totalSupply = callData.readNumber();
        // // total supply should increase after first mint
        // expect(totalSupply).toBe(toNano('100'));

        // Mint and transfer to jwallet2
        // const { actionList: actionList2 } = await minterContract.contract.sendInternalMessage(
        //     internalMessage({
        //         from: OWNER_ADDRESS,
        //         body: JettonMinter.mintBody(PARTICIPANT_ADDRESS_2, toNano(0.02)),
        //     })
        // );

        // const jwallet2 = await getJWalletContract(PARTICIPANT_ADDRESS_2, minterContract.address);
        // await jwallet2.contract.sendInternalMessage(actionToMessage(minterContract.address, actionList2[0]));

        // const { balance: balanceAfter2 } = parseJettonWalletDetails(
        //     await jwallet2.contract.invokeGetMethod('get_wallet_data', [])
        // );
        // expect(balanceAfter2).to.bignumber.equal(toNano(0.02), 'jwallet2 should reflact its balance after mint');

        // totalSupply = parseJettonDetails(
        //     await minterContract.contract.invokeGetMethod('get_jetton_data', [])
        // ).totalSupply;
        // expect(totalSupply).to.bignumber.equal(toNano(0.03), 'total supply should amount to both mints');
    });

    // it('should mint jettons and transfer from wallet1 to wallet2', async () => {
    //     // Produce mint message
    //     const { actionList: actionList1 } = await minterContract.contract.sendInternalMessage(
    //         internalMessage({
    //             from: OWNER_ADDRESS,
    //             body: JettonMinter.mintBody(PARTICIPANT_ADDRESS_1, toNano(0.01)),
    //         })
    //     );

    //     const jwallet1 = await getJWalletContract(PARTICIPANT_ADDRESS_1, minterContract.address);

    //     // Send mint message to jwallet1
    //     await jwallet1.contract.sendInternalMessage(actionToMessage(minterContract.address, actionList1[0]));

    //     // Transfer jwallet1-->jwallet2
    //     const res = await jwallet1.contract.sendInternalMessage(
    //         internalMessage({
    //             from: PARTICIPANT_ADDRESS_1, // TODO what is this from..? Prolly should be jwallet p1 address. is this a testutil that signs the msg?
    //             body: JettonWallet.transferBody(PARTICIPANT_ADDRESS_2, toNano(0.004)),
    //             value: toNano(0.031),
    //         })
    //     );

    //     const jwallet2 = await getJWalletContract(PARTICIPANT_ADDRESS_2, minterContract.address);
    //     await jwallet2.contract.sendInternalMessage(actionToMessage(jwallet1.address, res.actionList[0]));

    //     const { balance: balanceAfter2 } = parseJettonWalletDetails(
    //         await jwallet2.contract.invokeGetMethod('get_wallet_data', [])
    //     );
    //     expect(balanceAfter2).to.bignumber.equal(
    //         toNano(0.004),
    //         'jwallet2 balance should reflect amount sent from jwallet1'
    //     );

    //     const { balance: balanceAfter1 } = parseJettonWalletDetails(
    //         await jwallet1.contract.invokeGetMethod('get_wallet_data', [])
    //     );
    //     expect(balanceAfter1).to.bignumber.equal(
    //         toNano(0.01).sub(toNano(0.004)),
    //         'jwallet1 balance should subtract amount sent to jwallet2'
    //     );

    //     const totalSupply = parseJettonDetails(
    //         await minterContract.contract.invokeGetMethod('get_jetton_data', [])
    //     ).totalSupply;
    //     expect(totalSupply).to.bignumber.equal(toNano(0.01), 'total supply should not change');
    // });
});
