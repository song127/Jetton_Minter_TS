import { Address, BitBuilder, BitString, Cell, Dictionary, Slice, beginCell } from 'ton-core';

import { Sha256 } from '@aws-crypto/sha256-js';
import { JettonMetaDataKeys } from '../scripts/types';

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;

export const jettonParams = {
    name: 'DeanToken1',
    symbol: 'DT1',
    image: 'https://www.linkpicture.com/q/download_183.png', // Image url
    description: 'DeanToken1 is a token for Dean', // Description
};

const jettonOnChainMetadataSpec: {
    [key in JettonMetaDataKeys]: 'utf8' | 'ascii' | undefined;
} = {
    name: 'utf8',
    description: 'utf8',
    image: 'ascii',
    symbol: 'utf8',
};

const sha256 = (str: string) => {
    const sha = new Sha256();
    sha.update(str);
    return Buffer.from(sha.digestSync());
};

export function buildTokenMetadataCell(data: { [s: string]: string | undefined }): Cell {
    const dict = Dictionary.empty();

    Object.entries(data).forEach(([k, v]: [string, string | undefined]) => {
        if (!jettonOnChainMetadataSpec[k as JettonMetaDataKeys]) throw new Error(`Unsupported onchain key: ${k}`);
        if (v === undefined || v === '') return;

        let bufferToStore = Buffer.from(v, jettonOnChainMetadataSpec[k as JettonMetaDataKeys]);

        const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);

        let rootCell = new Cell();
        const builder = new BitBuilder();
        builder.writeUint(ONCHAIN_CONTENT_PREFIX, 8);
        let currentCell = rootCell;

        while (bufferToStore.length > 0) {
            builder.writeBuffer(bufferToStore.slice(0, CELL_MAX_SIZE_BYTES));
            bufferToStore = bufferToStore.slice(CELL_MAX_SIZE_BYTES);
            if (bufferToStore.length > 0) {
                const newCell = new Cell();
                currentCell.refs.push(newCell);
                currentCell = newCell;
            }
        }

        rootCell = rootCell.asBuilder().storeBits(builder.build()).endCell();

        dict.set(sha256(k), rootCell);
    });

    return beginCell()
        .storeInt(ONCHAIN_CONTENT_PREFIX, 8)
        .storeDict(dict, Dictionary.Keys.Buffer(32), Dictionary.Values.Cell())
        .endCell();
}

export function parseMetadata(cell: Cell) {
    const cellSlice = cell.beginParse();
    cellSlice.skip(8);
    const dict = cellSlice.loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());

    const result: any = {};

    Object.keys(jettonOnChainMetadataSpec).forEach((k) => {
        const valString = dict.get(sha256(k))?.beginParse().loadStringTail()!;
        const val = valString.substring(1, valString.length)
        if (val) result[k.toString() as JettonMetaDataKeys] = val;
    });

    return result;
}

export function jettonMinterInitData(
    owner: Address,
    walletCode: Cell,
    metadata: { [s in JettonMetaDataKeys]?: string }
): Cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeRef(buildTokenMetadataCell(metadata))
        .storeRef(walletCode)
        .endCell();
}

export function initData(owner: Address, walletCode: Cell) {
    return jettonMinterInitData(owner, walletCode, {
        name: jettonParams.name,
        symbol: jettonParams.symbol,
        image: jettonParams.image,
        description: jettonParams.description,
    });
}

export function walletInitData(walletOwnerAddress: Address, jettonMasterAddress: Address, walletCode: Cell) {
    return beginCell()
    .storeCoins(0)
    .storeAddress(walletOwnerAddress)
    .storeAddress(jettonMasterAddress)
    .storeRef(walletCode)
    .endCell();
}
