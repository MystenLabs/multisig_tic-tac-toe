import { Ed25519PublicKey } from '@mysten/sui.js/keypairs/ed25519';
import { MouseEvent, useState } from 'react';
import { MoveStructGame } from '../types/game-move';
import { MoveStructMark } from '../types/mark-move';
import { PACKAGE_ADDRESS, SUI_FULLNODE_URL } from '../config';
import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { fetchGame } from '../helpers/sui-fetch';
import { fromB64 } from '@mysten/bcs';
import { multisigPubKey } from '../helpers/keys';
import { sendMarkTxb } from '../helpers/txs';
import { useWalletKit } from '@mysten/wallet-kit';

export function useGame({ oppoPubKey, gameId }: { oppoPubKey: string, gameId: string }) {
    const { currentAccount, signTransactionBlock, signAndExecuteTransactionBlock } = useWalletKit();
    const [game, setGame] = useState<MoveStructGame | undefined>();
    const [board, setBoard] = useState<number[]>([]);
    const [trophyId, setTrophyId] = useState<{ won: boolean, trophyId: string } | undefined>();

    function isYourTurnFun(curTurn: number) {
        if (!game || !currentAccount) {
            return false;
        }
        if ((curTurn % 2 === 0 && game?.x_addr === currentAccount.address) ||
            (curTurn % 2 === 1 && game?.o_addr === currentAccount.address)) {
            return true
        }
        return false;
    }

    async function handleClick(e: MouseEvent) {
        if (!isYourTurnFun(game!.cur_turn)) {
            // TODO: Toaster instead
            console.log("Not your turn yet");
            return;
        }
        if (!gameId) {
            console.log("No game ID");
            return;
        }
        if (!oppoPubKey) {
            console.log("No opponent public key");
            return;
        }
        if (!currentAccount) {
            console.log("No current account");
            return;
        }

        const placement = parseInt((e.target as HTMLElement).id);
        if (board[placement] !== 0) {
            console.log("Invalid placement");
            return;
        }
        const sendMarkResp = await sendMarkTxb(currentAccount.address, gameId, placement);
        if (!sendMarkResp) {
            console.log("No transaction block");
        }

        const opponentPubKeyArray = fromB64(oppoPubKey).slice(1);
        const opponentPubKey = new Ed25519PublicKey(opponentPubKeyArray);
        let multiSigPublicKey;
        if (game?.x_addr == currentAccount.address) {
            multiSigPublicKey = multisigPubKey(new Ed25519PublicKey(currentAccount!.publicKey), opponentPubKey);
        } else {
            multiSigPublicKey = multisigPubKey(opponentPubKey, new Ed25519PublicKey(currentAccount!.publicKey));
        }
        const multiSigAddr = multiSigPublicKey.toSuiAddress();

        // REVIEW hardcoded: Find network from wallet
        const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });

        let mark;
        if (sendMarkResp) {
            const { txb: txb1, fetchedMark } = sendMarkResp;
            mark = fetchedMark;
            const resp1 = await signAndExecuteTransactionBlock({
                transactionBlock: txb1,
                requestType: "WaitForLocalExecution",
                options: {
                    showEffects: true
                }
            }).catch((e) => {
                console.log("Send mark txb call threw an error:");
                console.log(e);
            });

            if (resp1?.errors) {
                console.log("Error executing transaction block");
                console.log(resp1.errors);
                return;
            } else if (resp1?.effects?.status?.status !== 'success') {
                console.log("Failure executing transaction block");
                console.log(resp1?.effects?.status);
                return;
            }
        } else { // mark could be on the multisigAddr
            const marksResp = await suiClient.getOwnedObjects({
                owner: multiSigAddr,
                filter: {
                    StructType: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::Mark`
                },
                options: {
                    showContent: true
                }
            });

            const marks = marksResp.data.filter((markResp) => {
                const suiParsedData = markResp.data?.content as {
                    dataType: 'moveObject';
                    fields: MoveStructMark;
                    hasPublicTransfer: boolean;
                    type: string;
                };
                return suiParsedData.fields.game_id === gameId;
            });

            mark = (marks[0].data!.content as {
                dataType: 'moveObject';
                fields: MoveStructMark;
                hasPublicTransfer: boolean;
                type: string;
            }).fields;
        }
        if (!mark) {
            console.log("Couldn't find mark");
            return;
        }

        const txb2 = new TransactionBlock();

        txb2.moveCall({
            target: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::place_mark`,
            arguments: [
                txb2.object(gameId),
                txb2.object(mark.id.id)
            ]
        });

        txb2.setSender(multiSigAddr);
        txb2.setGasOwner(currentAccount!.address);
        const {
            signature: mySignature,
            transactionBlockBytes
        } = await signTransactionBlock({
            transactionBlock: txb2,
        });

        const combinedSignature = multiSigPublicKey.combinePartialSignatures([mySignature]);

        const resp2 = await suiClient.executeTransactionBlock({
            transactionBlock: transactionBlockBytes,
            signature: [combinedSignature, mySignature],
            options: {
                showEvents: true,
                showEffects: true,
                showObjectChanges: true,
                showBalanceChanges: true,
                showInput: true,
            }
        }).catch((e) => {
            console.log("Place mark txb call threw an error:");
            console.log(e);
        });


        if (resp2?.errors) {
            console.log("Error executing transaction block");
            console.log(resp2.errors);
            return;
        } else if (resp2?.effects?.status?.status !== 'success') {
            console.log("Failure executing transaction block");
            console.log(resp2?.effects?.status);
            return;
        }

        await updateGameState();
    }

    function renderSquare(index: number) {
        return board[index] === 1 ? 'X' : board[index] === 2 ? 'O' : ' ';
    }

    async function updateGameState() {
        if (!gameId) {
            console.log("No game ID");
            return;
        }

        const gameObject = await fetchGame(gameId)
        if (!gameObject) {
            console.log("No game object");
            return;
        }
        setGame(gameObject);
        setBoard(gameObject.gameboard);

        if (gameObject?.finished === 1 || gameObject?.finished === 2) {
            const owner = gameObject.finished === 1 ? gameObject.x_addr : gameObject.o_addr;
            const won = currentAccount?.address === owner ? true : false;
            const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });
            // TODO pagination
            const trophiesResp = await suiClient
                .getOwnedObjects({
                    owner,
                    filter: {
                        StructType: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::TicTacToeTrophy`
                    },
                    options: {
                        showContent: true
                    }
                });

            const trophyResp = trophiesResp.data.filter((trophyResp) => {
                const suiParsedData = trophyResp.data?.content as {
                    dataType: 'moveObject';
                    fields: {
                        id: {
                            id: string
                        },
                        winner: string,
                        loser: string,
                        played_as: number,
                        game_id: string,
                    },
                    hasPublicTransfer: boolean;
                    type: string;
                };
                return suiParsedData.fields.game_id === gameId;
            });

            if (!trophyResp.length) {
                console.log('No trophies found');
                return;
            }

            setTrophyId({
                won, trophyId: trophyResp[0].data!.objectId
            });
        }
    }

    function getCurrentTurnText() {
        if (game?.finished !== 0) {
            return 'Game finished!';
        }
        let curTurnText = `Current turn ${game.cur_turn}: `
        if (game.cur_turn % 2 === 0) {
            curTurnText = curTurnText.concat('X');
        } else {
            curTurnText = curTurnText.concat('O');
        }
        if (isYourTurnFun(game.cur_turn)) {
            curTurnText = curTurnText.concat(' (Your turn)');
        } else {
            curTurnText = curTurnText.concat(' (Opponents turn)');
        }
        return curTurnText;
    }

    function getFinishedText() {
        if (game?.finished === 0) {
            return (<p>
                Note: If new mark does not appear, try re - clicking on an empty cell
            </p>);
        }
        if (game?.finished === 3) {
            return (<p>It's a draw!</p>);
        }

        const href = `https://suiexplorer.com/object/${trophyId?.trophyId}`;
        if (trophyId?.won) {
            return (<>
                <p>You won! </p>
                <a href={href} > Trophy </a>
            </>);
        } else if (!trophyId?.won) {
            return (<>
                <p>You lost... </p>
                <a href={href} > Trophy </a>
            </>);
        }
    }

    return {
        handleClick,
        renderSquare,
        updateGameState,
        getCurrentTurnText,
        getFinishedText,
    };
}
