import { getHttpEndpoint } from '@orbs-network/ton-access';
import { KeyPair, mnemonicToWalletKey } from 'ton-crypto';
import { TonClient, WalletContractV4, Address, Sender, OpenedContract, toNano, fromNano } from 'ton';
import dotenv from 'dotenv';
import { run as deployRun } from './scripts/deployJetton';
import { run as walletDeployRun } from './scripts/deployJettonWallet';
import { RunParameter } from './scripts/types';
import { Jetton } from './wrappers/Jetton';
import { parseMetadata } from './wrappers/Jetton.util';
import { JettonWalletContract } from './wrappers/JettonWallet';
import { sleep } from '@ton-community/blueprint';

dotenv.config();

// Configs
const isDebug = true;
const isTest = true;

let endpoint: string;
let client: TonClient;

let mnemonic: string;
let key: KeyPair;
let wallet: WalletContractV4;
let walletContract: OpenedContract<WalletContractV4>;
let walletSender: Sender;

const deployer = 'kQAXKiZjT3geeflmDvkwF9qo52xu2WJXR3yT8mWBQKWXxxgT'; // main wallet == wallet.address
const user_1 = 'kQBLC7XLVFA0TLxm0bz_0YX12eM3faujd6rEcJTLU7KE9FF9'; // sub wallet

let jettonAddress = 'EQANdjxJrNhwe6Wc6ZeNMF-lHVkMjmulF36SG5rwVCNUbaA_'; // jetton minter address

let deployerJWalletAddress = 'EQBg3APUsPlKPLagAqBYLhz0692l__Mc_UjXbp0OlnxTBOP_'; // main wallet jetton wallet
let user1JWalletAddress = 'EQCT0Ddfavu3vdLFzo8rMcSouDuw6ct8_RI07Y9jz7LAXx4e'; // sub wallet jetton wallet

async function main() {
    try {
        await init();

        // jettonAddress = await deployJetton();
        // await getJettonDatas();

        // deployerJWalletAddress = await getJettonWalletAddress(deployer);
        // user1JWalletAddress = await getJettonWalletAddress(user_1);

        // await mintExecute(user_1);
        // await transferExecute(deployer, user_1, toNano('1'));
        await transferExecute(user_1, deployer, toNano('1'));
        await sleep(1000);
        // await getJettonDatas();
        await getWalletDetails(deployer);
        await getWalletDetails(user_1);
    } catch (e) {
        console.error(e);
    }
}

// Actions ------------------------------------------------------------------------------------------
async function transferExecute(from: string, to: string, amount: bigint) {
    const jWalletToAddress = Address.parse(await getJettonWalletAddress(from));
    const jettonWallet = client.open(JettonWalletContract.createFromAddress(jWalletToAddress));

    await jettonWallet.sendTransfer(walletSender, { amount, to: Address.parse(to) });
}

async function mintExecute(receiverAddress: string) {
    const jettonToAddress = Address.parse(jettonAddress);
    const jetton = client.open(Jetton.createFromAddress(jettonToAddress));

    await jetton.sendMint(walletSender, { amount: toNano('100'), to: Address.parse(receiverAddress) });

    await waitForTransaction();
}

async function createWallet(userAddress: string) {
    const params: RunParameter = {
        provider: client,
        wallet: walletContract,
        sender: walletSender,
    };

    return await walletDeployRun(params, Address.parse(userAddress), Address.parse(jettonAddress));
}

// Getters ------------------------------------------------------------------------------------------
async function getWalletDetails(ownerAddressStr: string) {
    const toAddress = Address.parse(await getJettonWalletAddress(ownerAddressStr));
    const wallet = client.open(JettonWalletContract.createFromAddress(toAddress));

    const callData = await wallet.getDetails();

    const balance = callData.readNumber();
    const ownerAddress = callData.readAddress();
    const jettonAddress = callData.readAddress();
    const code = callData.readCell();

    if (isDebug) {
        console.log('Jetton Balance :', fromNano(balance));
        console.log('Owner Address :', ownerAddress);
        console.log('Jetton Token Address :', jettonAddress);
    }
}

async function getJettonWalletAddress(owenrAddress: string) {
    const toAddress = Address.parse(jettonAddress);
    const jetton = client.open(Jetton.createFromAddress(toAddress));

    const callData = await jetton.getWalletAddress(Address.parse(owenrAddress));

    if (isDebug) {
        console.log('Calculate Jetton Wallet :', callData);
    }

    if (await client.isContractDeployed(callData)) {
        return callData.toString();
    } else {
        return await createWallet(owenrAddress);
    }
}

async function getJettonDatas() {
    const toAddress = Address.parse(jettonAddress);
    const jetton = client.open(Jetton.createFromAddress(toAddress));

    const callData = await jetton.getJettonDatas();

    const totalSupply = callData.readNumber();
    const tempInt = callData.readNumber();
    const adminAddress = callData.readAddress();
    const metadata = parseMetadata(callData.readCell());
    const jettonWalletCode = callData.readCell();

    const name = metadata.name;
    const symbol = metadata.symbol;
    const description = metadata.description;
    const image = metadata.image;

    if (isDebug) {
        console.log('Total :', totalSupply);
        console.log('EmptyData :', tempInt);
        console.log('Owner :', adminAddress);

        console.log('Name :', name);
        console.log('Symbol :', symbol);
        console.log('Desc :', description);
        console.log('Img :', image);
    }
}

// Utils --------------------------------------------------------------------------------------------
async function deployJetton() {
    const params: RunParameter = {
        provider: client,
        wallet: walletContract,
        sender: walletSender,
    };

    const result = await deployRun(params);

    if (isDebug) {
        console.log('Jetton Result :', result);
    }

    return result;
}

async function init() {
    endpoint = await getHttpEndpoint({ network: isTest ? 'testnet' : 'mainnet' });
    client = new TonClient({ endpoint });

    mnemonic = process.env.SECRET_KEY!; // your 24 secret words (replace ... with the rest of the words)
    key = await mnemonicToWalletKey(mnemonic.split(' '));
    wallet = WalletContractV4.create({
        publicKey: key.publicKey,
        workchain: 0,
    });
    walletContract = client.open(wallet);
    walletSender = walletContract.sender(key.secretKey);
}

async function waitForTransaction() {
    console.log('TX Start -----------------------------------------------------');
    const seqno = await walletContract.getSeqno();

    let currentSeqno = seqno;
    while (currentSeqno == seqno) {
        console.log('waiting for transaction to confirm...');
        await sleep(1500);
        currentSeqno = await walletContract.getSeqno();
    }
    console.log('TX End -------------------------------------------------------');
}

main();
