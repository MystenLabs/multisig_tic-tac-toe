import toast from 'react-hot-toast';
import { Ed25519PublicKey } from '@mysten/sui.js/keypairs/ed25519';
import { MouseEvent, useEffect, useState } from 'react';
import { MoveStructGame } from '../types/game-move';
import { PACKAGE_ADDRESS, SUI_FULLNODE_URL } from '../config';
import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { errorWithToast } from '../helpers/error-with-toast';
import { fetchGame, fetchMark } from '../helpers/sui-fetch';
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
            toast("Not your turn yet");
            return;
        }
        // REVIEW: These are not possible now correct?
        // Should I keep them?
        if (!gameId) {
            toast.error("No game ID");
            return;
        }
        if (!oppoPubKey) {
            toast.error("No opponent public key");
            return;
        }
        if (!currentAccount) {
            toast.error("No current account");
            return;
        }
        const placement = parseInt((e.target as HTMLElement).id);
        if (board[placement] !== 0) {
            toast.error("Invalid placement, try again");
            return;
        }

        // REVIEW hardcoded: Find network from wallet
        const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });

        const opponentPubKeyArray = fromB64(oppoPubKey).slice(1);
        const opponentPubKey = new Ed25519PublicKey(opponentPubKeyArray);
        let multiSigPublicKey;
        if (game?.x_addr == currentAccount.address) {
            multiSigPublicKey = multisigPubKey(new Ed25519PublicKey(currentAccount!.publicKey), opponentPubKey);
        } else {
            multiSigPublicKey = multisigPubKey(opponentPubKey, new Ed25519PublicKey(currentAccount!.publicKey));
        }
        const multiSigAddr = multiSigPublicKey.toSuiAddress();

        let mark = await fetchMark(currentAccount.address, gameId);
        if (mark) {
            const sendTxb = sendMarkTxb({ mark, placement });

            const sendResp = await signAndExecuteTransactionBlock({
                transactionBlock: sendTxb,
                requestType: "WaitForLocalExecution",
                options: {
                    showEffects: true
                }
            }).catch((e) => {
                errorWithToast("Send mark txb call threw an error", e);
            });

            if (!sendResp) {
                return;
            }
            if (sendResp.errors) {
                errorWithToast("Error executing transaction block", sendResp.errors);
                return;
            } else if (sendResp.effects?.status?.status !== 'success') {
                errorWithToast("Failure executing transaction block", sendResp?.effects);
                return;
            }
        } else { // May be already sent
            mark = await fetchMark(multiSigAddr, gameId);
        }

        if (!mark) {
            toast.error("Something went wrong fetching the mark");
            return;
        }

        const txbPlace = new TransactionBlock();

        txbPlace.moveCall({
            target: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::place_mark`,
            arguments: [
                txbPlace.object(gameId),
                txbPlace.object(mark.id.id)
            ]
        });

        txbPlace.setSender(multiSigAddr);
        txbPlace.setGasOwner(currentAccount!.address);
        const {
            signature: mySignature,
            transactionBlockBytes
        } = await signTransactionBlock({
            transactionBlock: txbPlace,
        });

        const combinedSignature = multiSigPublicKey.combinePartialSignatures([mySignature]);

        const respPlace = await suiClient.executeTransactionBlock({
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
            errorWithToast("Place mark txb call threw an error", e);
        });

        if (!respPlace) {
            return;
        }
        if (respPlace.errors) {
            errorWithToast("Error executing transaction block", respPlace.errors);
            return;
        } else if (respPlace.effects?.status?.status !== 'success') {
            errorWithToast("Failure executing transaction block", respPlace?.effects);
            return;
        }

        await updateGameState();
    }

    function renderSquare(index: number) {
        return board[index] === 1 ? 'X' : board[index] === 2 ? 'O' : ' ';
    }

    async function updateGameState() {
        if (!gameId) {
            toast.error("No game ID");
            return;
        }

        const gameObject = await fetchGame(gameId)
        if (!gameObject) {
            toast.error("No game object");
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
                }).catch((e) => {
                    errorWithToast("Get trophies call threw an error", e);
                });

            if (!trophiesResp) {
                return;
            }

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
                toast.error('No trophies found');
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
        if (!game || ! trophyId) {
            return;
        }
        if (game.finished === 0) {
            return (<p>
                Note: If new mark does not appear, try re - clicking on an empty cell
            </p>);
        }
        if (game.finished === 3) {
            toast("It's a draw!");
            return (<p>It's a draw!</p>);
        }

        const href = `https://suiexplorer.com/object/${trophyId?.trophyId}`;
        if (trophyId?.won) {
            // REVIEW: toast sometimes has a conflict like:
            // Warning: Cannot update a component (`Ie`) while rendering a different component (`Game`). To locate the bad setState() call inside `Game`, follow the stack trace as described in
            toast.success("You won!");
            return (<>
                <p>You won! </p>
                <a href={href} > Trophy </a>
            </>);
        } else if (!trophyId?.won) {
            // REVIEW: toast sometimes has a conflict like:
            // Warning: Cannot update a component (`Ie`) while rendering a different component (`Game`). To locate the bad setState() call inside `Game`, follow the stack trace as described in
            toast("You lost...");
            return (<>
                <p>You lost... </p>
                <a href={href} > Trophy </a>
            </>);
        }
    }

    // REVIEW: Leaving empty dependencies keeps game state as undefined.
    // REVIEW: This seems a little illegal. I have an interval loop in my hooks
    // Poll the blockchain every 1 sec
    useEffect(() => {
        // Create an interval that updates the state every 1 second
        const intervalId = setInterval(() => {
            console.log("update loop");
            if (game && game.finished !== 0) {
                clearInterval(intervalId);
                return;
            }
            updateGameState();
        }, 1000); // 1000 milliseconds = 1 second

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game]); // ~~Only run once~~

    return {
        handleClick,
        renderSquare,
        getCurrentTurnText,
        getFinishedText,
    };
}
