import { PACKAGE_ADDRESS } from "../config";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { MoveStructMark } from "../types/mark-move";

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

export function sendMarkTxb(args: {
    mark: MoveStructMark,
    placement: number
}) {
    const { mark, placement } = args;
    // get row/col from col-major index
    const row = placement % 3;
    const col = Math.floor(placement / 3);

    const txb = new TransactionBlock();

    txb.moveCall({
        target: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::send_mark_to_game`,
        arguments: [
            txb.object(mark.id.id),
            txb.pure.u8(row),
            txb.pure.u8(col)
        ]
    });

    return txb;
}


