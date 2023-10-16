import { SuiClient } from '@mysten/sui.js/client';
import { MouseEventHandler, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PACKAGE_ADDRESS, SUI_FULLNODE_URL, multisigPubKey } from '../config';
import { useWalletKit } from '@mysten/wallet-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519PublicKey } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64, toB64 } from '@mysten/bcs';
import { SIGNATURE_SCHEME_TO_FLAG } from '@mysten/sui.js/cryptography';

type GameMoveObject = {
    cur_turn: number,
    finished: number,
    gameboard: number[],
    id: {
        id: string
    },
    o_addr: string,
    x_addr: string
};

type MarkMoveObject = {
    id: {
        id: string
    },
    game_id: string,
    placement?: number,
    during_turn: boolean,
    from: string,
    game_owners: string,
};

async function fetchGame(gameId: string) {
    // TODO hardcoded: Find network from wallet
    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });

    const gameResp = await suiClient.getObject({
        id: gameId!,
        options: { showContent: true }
    });

    const fetchedGame = gameResp.data;
    if (!fetchedGame) {
        console.log('Game not found');
        return;
    }
    const suiParsedData = fetchedGame.content as {
        dataType: 'moveObject';
        fields: GameMoveObject;
        hasPublicTransfer: boolean;
        type: string;
    };

    return suiParsedData.fields;
}

async function fetchMark(owner: string, gameId: string) {
    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });

    const marksResp = await suiClient.getOwnedObjects({
        owner,
        filter: {
            StructType: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::Mark`
        },
        options: {
            showContent: true
        }
    });

    const fetchedMarks = marksResp.data.filter((mark) => {
        const suiParsedData = mark.data?.content as {
            dataType: 'moveObject';
            fields: MarkMoveObject;
            hasPublicTransfer: boolean;
            type: string;
        };
        return suiParsedData.fields.game_id === gameId;
    });
    if (!fetchedMarks.length) {
        console.log('Marks not found');
        return;
    }
    const content0 = fetchedMarks[0]?.data?.content as {
        dataType: 'moveObject';
        fields: MarkMoveObject;
        hasPublicTransfer: boolean;
        type: string;
    };
    return content0.fields;
}

async function sendMarkTxb(address: string, gameId: string, placement: number) {

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

function Game() {
    const { currentAccount, signTransactionBlock, signAndExecuteTransactionBlock } = useWalletKit();
    const { oppoPubKey, gameId } = useParams<{ oppoPubKey: string, gameId: string }>();

    const [game, setGame] = useState<GameMoveObject | undefined>();
    // const [mark, setMark] = useState<MarkMoveObject | undefined>();
    const [board, setBoard] = useState<number[]>([]);
    // const [isYourTurn, setIsYourTurn] = useState(false);
    const [trophyId, setTrophyId] = useState<{ won: boolean, trophyId: string } | undefined>();

    const isYourTurnFun = (curTurn: number) => {
        if (!game || !currentAccount) {
            return false;
        }
        if ((curTurn % 2 === 0 && game?.x_addr === currentAccount.address) ||
            (curTurn % 2 === 1 && game?.o_addr === currentAccount.address)) {
            return true
        }
        return false;
    };

    const handleClick: MouseEventHandler<HTMLTableDataCellElement> = async (e) => {
        if (!isYourTurnFun(game!.cur_turn)) {
            // TODO: Popups instead
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

        const placement = parseInt((e.target as HTMLTableDataCellElement).id);
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

        // TODO hardcoded: Find network from wallet
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
            });

            if (resp1.errors) {
                console.log("Error executing transaction block");
                console.log(resp1.errors);
                return;
            } else if (resp1.effects?.status?.status !== 'success') {
                console.log("Failure executing transaction block");
                console.log(resp1.effects?.status);
                return;
            }
        } else { // mark could be on the multisigAddr
            // const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });
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
                    fields: MarkMoveObject;
                    hasPublicTransfer: boolean;
                    type: string;
                };
                return suiParsedData.fields.game_id === gameId;
            });

            mark = (marks[0].data!.content as {
                dataType: 'moveObject';
                fields: MarkMoveObject;
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

        try {
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
            });

            if (resp2.errors) {
                console.log("Error executing transaction block");
                console.log(resp2.errors);
                return;
            } else if (resp2.effects?.status?.status !== 'success') {
                console.log("Failure executing transaction block");
                console.log(resp2.effects?.status);
                return;
            }
        } catch (e) {
            console.log("Executing multisig transaction threw exception:");
            console.log(e);
            return;
        }

        await updateGameState();
    };

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
            Note: If new mark does not appear, try re-clicking on an empty cell
            </p>);
        }
        if (game?.finished === 3) {
            return (<p>It's a draw!</p>);
        }

        const href = `https://suiexplorer.com/object/${trophyId?.trophyId}`;
        if (trophyId?.won) {
            return (<>
                <p>You won! </p>
                <a href={href}>Trophy</a>
            </>);
        } else if (!trophyId?.won) {
            return (<>
                <p>You lost... </p>
                <a href={href}>Trophy</a>
            </>);
        }
    }

    useEffect(() => {
        // Create an interval that updates the state every 1 second
        const intervalId = setInterval(() => {
            updateGameState();
        }, 1000); // 1000 milliseconds = 1 second

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once

    function ed25519PublicKeyB64(pk: Uint8Array) {
        const pkNew = new Uint8Array([SIGNATURE_SCHEME_TO_FLAG['ED25519'], ...pk]);
        return toB64(pkNew);
    }

    return (
        <div className='tw-text-center tw-flex tw-flex-col tw-w-full tw-items-center'>
            <h1>Multisig Tic Tac Toe</h1>
            <div className='tw-text-left'>
                <p>
                    My Public Key: {currentAccount && ed25519PublicKeyB64(currentAccount.publicKey)}<br />
                    (Share it with opponent to join game)</p>
                <p>Game ID: {gameId}<br />
                    {getCurrentTurnText()}</p>
            </div>
            <table>
                <tbody>
                    {Array(3)
                        .fill(null)
                        .map((_, row) => (
                            <tr key={row} className="board-row">
                                {Array(3)
                                    .fill(null)
                                    .map((_, col) => {
                                        const index = row * 3 + col;
                                        return (<td
                                            className='tw-border tw-w-20 tw-h-20 tw-text-6xl tw-text-center'
                                            id={index.toString()}
                                            key={col}
                                            onClick={handleClick}>
                                            {renderSquare(index)}
                                        </td>);
                                    })}
                            </tr>
                        ))}
                </tbody>
            </table>
            <div className='tw-text-center'>{getFinishedText()}</div>
        </div>
    );
}

export default Game;
