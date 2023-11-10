import { PACKAGE_ADDRESS } from "../config";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { fetchMark } from "./sui-fetch";

export function createGameTxb({
    myAddr,
    oppoAddr,
}: {
    myAddr: string;
    oppoAddr: string;
}) {
    const txb = new TransactionBlock();

    txb.moveCall({
        target: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::create_game`,
        arguments: [txb.pure.address(myAddr), txb.pure.address(oppoAddr)],
    });

    return txb;
}

export async function sendMarkTxb(address: string, gameId: string, placement: number) {

    const fetchedMark = await fetchMark(address, gameId);
    if (!fetchedMark) {
        console.log("No mark object");
        return;
    }

    // get row/col from col-major index
    const row = placement % 3;
    const col = Math.floor(placement / 3);

    const txb = new TransactionBlock();

    txb.moveCall({
        target: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::send_mark_to_game`,
        arguments: [
            txb.object(fetchedMark.id.id),
            txb.pure.u8(row),
            txb.pure.u8(col)
        ]
    });

    return { txb, fetchedMark };
}


