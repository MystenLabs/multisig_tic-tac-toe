import toast from "react-hot-toast";
import { Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { MouseEvent, useEffect, useState } from "react";
import { MoveStructGame } from "../types/game-move";
import { PACKAGE_ADDRESS, SUI_FULLNODE_URL } from "../config";
import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { errorWithToast } from "../helpers/error-with-toast";
import { fetchGame, fetchMark } from "../helpers/sui-fetch";
import { fromB64 } from "@mysten/bcs";
import { multisigPubKey } from "../helpers/keys";
import { sendMarkTxb } from "../helpers/txs";
import { useWalletKit } from "@mysten/wallet-kit";
import { isYourTurn } from "../helpers/isYourTurn";

// TODO: split the two transaction blocks into two functions and call them with await inside the handleClick function
// TODO: add pagination comment

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
  const [trophyId, setTrophyId] = useState<
    { won: boolean; trophyId: string } | undefined
  >();

  useEffect(() => {
    console.log("Game object changed:", game);
    updateTrophyState();
  }, [game]);

  useEffect(() => {
    console.log({ finished: game?.finished });
    updateGameState();
    // Create an interval that updates the state every 3 second
    const intervalId = setInterval(() => {
      console.log("update loop");
      updateGameState();
    }, 3000);
    if (!game || game.finished !== 0) {
      clearInterval(intervalId);
      return;
    }
    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.finished]);

  async function handleClick(e: MouseEvent) {
    if (!isYourTurn({ game, currentAddress: currentAccount?.address })) {
      toast("Not your turn yet");
      return;
    }
    if (!currentAccount) {
      toast.error("No current account");
      return;
    }
    const placement = parseInt((e.target as HTMLElement).id);
    if (game?.gameboard[placement] !== 0) {
      toast.error("Invalid placement, try again");
      return;
    }

    // REVIEW hardcoded: Find network from wallet
    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });

    const opponentPubKeyArray = fromB64(oppoPubKey).slice(1);
    const opponentPubKey = new Ed25519PublicKey(opponentPubKeyArray);
    let multiSigPublicKey;
    if (game?.x_addr == currentAccount.address) {
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
        errorWithToast("Send mark txb call threw an error", e);
      });

      if (!sendResp) {
        return;
      }
      if (sendResp.errors) {
        errorWithToast("Error executing transaction block", sendResp.errors);
        return;
      } else if (sendResp.effects?.status?.status !== "success") {
        errorWithToast(
          "Failure executing transaction block",
          sendResp?.effects
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
        errorWithToast("Place mark txb call threw an error", e);
      });

    if (!respPlace) {
      return;
    }
    if (respPlace.errors) {
      errorWithToast("Error executing transaction block", respPlace.errors);
      return;
    } else if (respPlace.effects?.status?.status !== "success") {
      errorWithToast("Failure executing transaction block", respPlace?.effects);
      return;
    }

    await updateGameState();
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
      return;
    }
    setGame(gameObject);
  }

  async function updateTrophyState() {
    if (game?.finished === 1 || game?.finished === 2) {
      const owner = game.finished === 1 ? game.x_addr : game.o_addr;
      const won = currentAccount?.address === owner ? true : false;
      const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });
      // TODO pagination
      const trophiesResp = await suiClient
        .getOwnedObjects({
          owner,
          filter: {
            StructType: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::TicTacToeTrophy`,
          },
          options: {
            showContent: true,
          },
        })
        .catch((e) => {
          errorWithToast("Get trophies call threw an error", e);
        });

      if (!trophiesResp) {
        return;
      }

      const trophyResp = trophiesResp.data.filter((trophyResp) => {
        const suiParsedData = trophyResp.data?.content as {
          dataType: "moveObject";
          fields: {
            id: {
              id: string;
            };
            winner: string;
            loser: string;
            played_as: number;
            game_id: string;
          };
          hasPublicTransfer: boolean;
          type: string;
        };
        return suiParsedData.fields.game_id === gameId;
      });

      if (!trophyResp.length) {
        toast.error("No trophies found");
        return;
      }

      setTrophyId({
        won,
        trophyId: trophyResp[0].data!.objectId,
      });
    }
  }

  function getFinishedText() {
    if (!game || !trophyId) {
      return;
    }
    if (game.finished === 0) {
      return (
        <p>
          Note: If new mark does not appear, try re - clicking on an empty cell
        </p>
      );
    }

    let button = <></>;
    if (!!game.finished) {
      button = (
        <div className="pt-4">
          <button
            type="button"
            className="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900"
            onClick={deleteGame}
          >
            Delete Game Object
          </button>
        </div>
      );
    }
    if (game.finished === 3) {
      toast("It's a draw!");
      return (
        <>
          <p>It's a draw!</p>
          {button}
        </>
      );
    }

    const href = `https://suiexplorer.com/object/${trophyId?.trophyId}?network=testnet`;
    if (trophyId?.won) {
      // REVIEW: toast sometimes has a conflict like:
      // Warning: Cannot update a component (`Ie`) while rendering a different component (`Game`). To locate the bad setState() call inside `Game`, follow the stack trace as described in
      toast.success("You won!");
      return (
        <>
          <p>You won! </p>
          <a href={href}> Trophy </a>
          {button}
        </>
      );
    } else if (!trophyId?.won) {
      // REVIEW: toast sometimes has a conflict like:
      // Warning: Cannot update a component (`Ie`) while rendering a different component (`Game`). To locate the bad setState() call inside `Game`, follow the stack trace as described in
      toast("You lost...");
      return (
        <>
          <p>You lost... </p>
          <a href={href}> Trophy </a>
        </>
      );
    }
  }

  async function deleteGame() {
    if (!gameId) {
      toast.error("No game ID");
    }
    if (!game) {
      toast.error("No game object");
    }
    if (game?.finished === 0) {
      toast.error("Game not finished yet");
    }

    const opponentPubKeyArray = fromB64(oppoPubKey).slice(1);
    const opponentPubKey = new Ed25519PublicKey(opponentPubKeyArray);
    let multiSigPublicKey;
    if (game?.x_addr == currentAccount!.address) {
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

    // REVIEW: Hardcoded
    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });
    const txbDelete = new TransactionBlock();

    txbDelete.moveCall({
      target: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::delete_game`,
      arguments: [txbDelete.object(gameId)],
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
      .then((resp) => {
        if (resp.effects?.status.status !== "success") {
          console.log(resp?.effects);
          throw new Error("Failure executing transaction block");
        }
        updateGameState();
        toast.success("Game deleted");
      })
      .catch((e) => {
        errorWithToast("Delete game txb call threw an error", e);
      });
  }

  return {
    game,
    handleClick,
    getFinishedText,
  };
}
