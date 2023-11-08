import { ChangeEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { fromB64, toB64 } from "@mysten/bcs";
import { useWalletKit } from "@mysten/wallet-kit";
import { PACKAGE_ADDRESS, SUI_FULLNODE_URL, multisigPubKey } from "../config";
import { SIGNATURE_SCHEME_TO_FLAG } from "@mysten/sui.js/cryptography";

export const useCreateOrJoinGame = () => {
  const { currentAccount, signTransactionBlock } = useWalletKit();

  const [opponentPubKey, setOpponentPubKey] = useState("");
  const [opponentValid, setOpponentValid] = useState(false);
  const navigate = useNavigate();

  function createGameTxb({
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

  async function findGame(multiSigAddr: string) {
    // TODO hardcoded: Find network from wallet
    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });
    const games = await suiClient.getOwnedObjects({
      owner: multiSigAddr,
      filter: {
        StructType: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::TicTacToe`,
      },
      options: { showContent: true },
    });

    /// Just in case someone send the gameboard to the wrong address
    const validGames = games.data.filter((objResp) => {
      const content = objResp.data?.content;
      if (content?.dataType != "moveObject") {
        return false;
      }
      const fields = content.fields as {
        o_addr: string;
        x_addr: string;
        finished: number;
      };
      return fields["finished"] === 0;
    });

    if (!validGames.length) {
      console.log("No games found");
      return;
    }
    return validGames[0].data;
  }

  async function handleOpponentChange(e: ChangeEvent<HTMLInputElement>) {
    const newOpponent = e.target.value;
    const opponentPubKeyArray = fromB64(newOpponent).slice(1);

    setOpponentPubKey(newOpponent);
    try {
      new Ed25519PublicKey(opponentPubKeyArray);
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

    // TODO hardcoded: Find network from wallet
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
    });

    if (resp.errors) {
      console.log(resp.errors);
      return;
    } else if (resp.effects?.status.status !== "success") {
      console.log(resp.effects);
      return;
    }

    const game = resp.objectChanges?.filter((objChng) => {
      return (
        objChng.type === "created" &&
        objChng.objectType ===
          `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::TicTacToe`
      );
    })[0] as {
      digest: string;
      objectId: string;
      objectType: string;
      sender: string;
      type: "created";
      version: string;
    };
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

  function ed25519PublicKeyB64(pk: Uint8Array) {
    const pkNew = new Uint8Array([SIGNATURE_SCHEME_TO_FLAG["ED25519"], ...pk]);
    return toB64(pkNew);
  }
  return {
    opponentPubKey,
    opponentValid,
    handleOpponentChange,
    handleCreateGame,
    handleJoinGame,
    ed25519PublicKeyB64,
  };
};
