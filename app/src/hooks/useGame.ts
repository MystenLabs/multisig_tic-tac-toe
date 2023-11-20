import { useEffect, useState} from "react";
import toast from "react-hot-toast";
import { useWalletKit } from "@mysten/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { MultiSigPublicKey } from "@mysten/sui.js/multisig";
import { Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { fromB64 } from "@mysten/bcs";

import { MoveStructGame } from "../types/game-move";
import { PACKAGE_ADDRESS, SUI_FULLNODE_URL } from "../config";
import { consoleAndToast } from "../helpers/consoleAndToast";
import { fetchGame, fetchMark } from "../helpers/suiFetch";
import { isYourTurn } from "../helpers/isYourTurn";
import { multisigPubKey } from "../helpers/keys";
import { sendMarkTxb } from "../helpers/txbs";

export function useGame({
    oppoPubKey,
    gameId,
}: {
    oppoPubKey: string;
    gameId: string;
}) {
    const {
        currentAccount,
        signTransactionBlock,
        signAndExecuteTransactionBlock,
    } = useWalletKit();
    const [game, setGame] = useState<MoveStructGame | undefined>();
    const [gameDeleted, setGameDeleted] = useState(false);

    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });
    const opponentPubKeyArray = fromB64(oppoPubKey).slice(1);
    const opponentPubKey = new Ed25519PublicKey(opponentPubKeyArray);
    let multiSigPublicKey: MultiSigPublicKey;
    if (game?.x_addr == currentAccount?.address) {
        multiSigPublicKey = multisigPubKey(
            new Ed25519PublicKey(currentAccount!.publicKey),
            opponentPubKey
        );
    } else {
        multiSigPublicKey = multisigPubKey(
            opponentPubKey,
            new Ed25519PublicKey(currentAccount!.publicKey)
        );
    }
    const multiSigAddr = multiSigPublicKey.toSuiAddress();

    useEffect(() => {
        console.log({ finished: game?.finished });
        if (!gameDeleted) {
            updateGameState();
        }
        // Create an interval that updates the state every 3 second
        const intervalId = setInterval(() => {
            console.log("update loop");
            updateGameState();
        }, 3000);
        if (game && gameDeleted) {
            clearInterval(intervalId);
            return;
        }
        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
        // Do not useEffect on every game change, only when finish changed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameDeleted]);

    async function placeMark(placement: number) {
        if (!isYourTurn({ game, currentAddress: currentAccount?.address })) {
            toast("Not your turn yet");
            return;
        }
        if (!currentAccount) {
            toast.error("No current account");
            return;
        }
        if (game?.gameboard[placement] !== 0) {
            toast.error("Invalid placement, try again");
            return;
        }

        // ------ 1st transaction block ------
        let mark = await fetchMark(currentAccount.address, gameId);
        if (mark) {
            const sendTxb = sendMarkTxb({ mark, placement });

            const sendResp = await signAndExecuteTransactionBlock({
                transactionBlock: sendTxb,
                requestType: "WaitForLocalExecution",
                options: {
                    showEffects: true,
                },
            }).catch((e) => {
                consoleAndToast(e, "Send mark txb call threw an error");
            });

            if (!sendResp) {
                return;
            }
            if (sendResp.errors) {
                consoleAndToast(sendResp.errors, "Error executing transaction block");
                return;
            } else if (sendResp.effects?.status?.status !== "success") {
                consoleAndToast(
                    sendResp?.effects,
                    "Failure executing transaction block"
                );
                return;
            }
        } else {
            // May be already sent
            mark = await fetchMark(multiSigAddr, gameId);
        }

        // ------ 2nd transaction block ------

        if (!mark) {
            toast.error("Something went wrong fetching the mark");
            return;
        }

        const txbPlace = new TransactionBlock();

        txbPlace.moveCall({
            target: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::place_mark`,
            arguments: [txbPlace.object(gameId), txbPlace.object(mark.id.id)],
        });

        txbPlace.setSender(multiSigAddr);
        txbPlace.setGasOwner(currentAccount!.address);
        const { signature: mySignature, transactionBlockBytes } =
            await signTransactionBlock({
                transactionBlock: txbPlace,
            });

        const combinedSignature = multiSigPublicKey.combinePartialSignatures([
            mySignature,
        ]);

        const respPlace = await suiClient
            .executeTransactionBlock({
                transactionBlock: transactionBlockBytes,
                signature: [combinedSignature, mySignature],
                options: {
                    showEvents: true,
                    showEffects: true,
                    showObjectChanges: true,
                    showBalanceChanges: true,
                    showInput: true,
                },
            })
            .catch((e) => {
                consoleAndToast(e, "Place mark txb call threw an error");
            });

        if (!respPlace) {
            return;
        }
        if (respPlace.errors) {
            consoleAndToast(respPlace.errors, "Error executing transaction block");
            return;
        } else if (respPlace.effects?.status?.status !== "success") {
            consoleAndToast(respPlace?.effects, "Failure executing transaction block");
            return;
        }

        await updateGameState();
    }

    async function deleteGame() {
        console.log("deleteGame");
        if (!game || game.finished === 0) {
            throw new Error("Game not finished");
        }
        const txbDelete = new TransactionBlock();

        txbDelete.moveCall({
            target: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::delete_game`,
            arguments: [txbDelete.object(game.id.id)],
        });

        txbDelete.setSender(multiSigAddr);
        txbDelete.setGasOwner(currentAccount!.address);
        const { signature: mySignature, transactionBlockBytes } =
            await signTransactionBlock({
                transactionBlock: txbDelete,
            });

        const combinedSignature = multiSigPublicKey.combinePartialSignatures([
            mySignature,
        ]);

        await suiClient
            .executeTransactionBlock({
                transactionBlock: transactionBlockBytes,
                signature: [combinedSignature, mySignature],
                options: {
                    showEvents: true,
                    showEffects: true,
                    showObjectChanges: true,
                    showBalanceChanges: true,
                    showInput: true,
                },
            })
            .then(async (resp) => {
                if (resp.effects?.status.status !== "success") {
                    console.log(resp?.effects);
                    throw new Error("Failure executing transaction block");
                }
                toast.success("Game deleted");
                await updateGameState();
            })
            .catch((e) => {
                consoleAndToast(e, "Delete game txb call threw an error");
            });
    }

    async function updateGameState() {
        console.log("I am updating game state");
        if (!gameId) {
            toast.error("No game ID");
            return;
        }
        const gameObject = await fetchGame(gameId);
        if (!gameObject) {
            toast.error("No game object");
            setGameDeleted(true);
            return;
        }
        setGame(gameObject);
    }

    return {
        placeMark,
        game,
        deleteGame: gameDeleted ? undefined : deleteGame
    };
}
