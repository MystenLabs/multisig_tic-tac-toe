import { ChangeEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletKit } from "@mysten/wallet-kit";
import { SuiClient, SuiObjectChangeCreated } from "@mysten/sui.js/client";
import { Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { fromB64 } from "@mysten/bcs";

import { PACKAGE_ADDRESS, SUI_FULLNODE_URL } from "../config";
import { createGameTxb } from "../helpers/txbs";
import { findGame } from "../helpers/suiFetch";
import { multisigPubKey } from "../helpers/keys";
import { consoleAndToast } from "../helpers/consoleAndToast";

export const useCreateOrJoinGame = () => {
    const { currentAccount, signTransactionBlock } = useWalletKit();

    const [opponentPubKey, setOpponentPubKey] = useState("");
    const [opponentValid, setOpponentValid] = useState(false);
    const navigate = useNavigate();

    async function handleOpponentChange(e: ChangeEvent<HTMLInputElement>) {
        const newOpponent = e.target.value;
        const opponentPubKeyArray = fromB64(newOpponent).slice(1);

        setOpponentPubKey(newOpponent);
        try {
            multisigPubKey(
                new Ed25519PublicKey(opponentPubKeyArray),
                new Ed25519PublicKey(currentAccount!.publicKey)
            );
        } catch (e) {
            setOpponentValid(false);
            return;
        }
        setOpponentValid(true);
    }

    async function handleCreateGame() {
        const opponentPubKeyArray = fromB64(opponentPubKey).slice(1);
        const oppoPubKey = new Ed25519PublicKey(opponentPubKeyArray);
        const oppoAddr = oppoPubKey.toSuiAddress();
        const txb = createGameTxb({ myAddr: currentAccount!.address, oppoAddr });

        const multiSigPublicKey = multisigPubKey(
            new Ed25519PublicKey(currentAccount!.publicKey),
            oppoPubKey
        );
        const multiSigAddr = multiSigPublicKey.toSuiAddress();

        txb.setSender(multiSigAddr);
        txb.setGasOwner(currentAccount!.address);
        const { signature: mySignature, transactionBlockBytes } =
            await signTransactionBlock({
                transactionBlock: txb,
            });

        const combinedSignature = multiSigPublicKey.combinePartialSignatures([
            mySignature,
        ]);

        const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });
        const resp = await suiClient.executeTransactionBlock({
            transactionBlock: transactionBlockBytes,
            signature: [combinedSignature, mySignature],
            options: {
                showEvents: true,
                showEffects: true,
                showObjectChanges: true,
                showBalanceChanges: true,
                showInput: true,
            },
        }).catch((e) => {
            consoleAndToast(e, "Create game txb call threw error");
        });
        if (!resp) {
            return;
        }

        if (resp.errors) {
            consoleAndToast(resp.errors, "Error during create game txb");
            return;
        } else if (resp.effects?.status.status !== "success") {
            consoleAndToast(resp.effects, "Failure during create game txb");
            return;
        }

        const game = resp.objectChanges?.filter((objChng) => {
            return (
                objChng.type === "created" &&
                objChng.objectType ===
                `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::TicTacToe`
            );
        }).at(0) as SuiObjectChangeCreated | undefined;
        if (!game) {
            consoleAndToast(resp.objectChanges, "No game found in object changes");
            return;
        }

        const keyForUrl = opponentPubKey.replace(/\//g, "%2F");
        navigate(`game/${keyForUrl}/${game.objectId}`);
    }

    async function handleJoinGame() {
        const opponentPubKeyArray = fromB64(opponentPubKey).slice(1);
        const oppoPubKey = new Ed25519PublicKey(opponentPubKeyArray);
        const multiSigPublicKeyAsO = multisigPubKey(
            oppoPubKey,
            new Ed25519PublicKey(currentAccount!.publicKey)
        );
        const multiSigAddrAsO = multiSigPublicKeyAsO.toSuiAddress();
        const multiSigPubKeyAsX = multisigPubKey(
            new Ed25519PublicKey(currentAccount!.publicKey),
            oppoPubKey
        );
        const multiSigAddrAsX = multiSigPubKeyAsX.toSuiAddress();

        let game = await findGame(multiSigAddrAsO);

        if (!game) {
            game = await findGame(multiSigAddrAsX);
        }

        const keyForUrl = opponentPubKey.replace(/\//g, "%2F");
        navigate(`/game/${keyForUrl}/${game!.objectId}`);
    }

    return {
        opponentPubKey,
        opponentValid,
        handleOpponentChange,
        handleCreateGame,
        handleJoinGame,
    };
};
