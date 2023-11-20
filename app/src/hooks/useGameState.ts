import { useEffect, useState } from "react";
import { Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { fromB64 } from "@mysten/bcs";

import { MoveStructGame } from "../types/game-move";
import { consoleAndToast } from "../helpers/consoleAndToast";
import { fetchTrophy } from "../helpers/suiFetch";

export function useGameState(args: { game: MoveStructGame, oppoPubKeyB64: string}) {
    const {
        game,
        oppoPubKeyB64,
    } = args;

    const oppoPubKey = new Ed25519PublicKey(fromB64(oppoPubKeyB64).slice(1));
    const gameFinished = game.finished !== 0;
    const isXTurn = !gameFinished && game.cur_turn % 2 === 0;
    const isMyTurn = !gameFinished && isXTurn == (oppoPubKey.toSuiAddress() === game.o_addr);

    const [trophyId, setTrophyId] = useState<string | undefined>();

    useEffect(() => {
        fetchTrophy(game)
            .then((trophy) => {
                setTrophyId(trophy);
            })
            .catch((err) => {
                setTrophyId(undefined);
                consoleAndToast(err, "Something went wrong when trying to fetch trophy");
            });
    }, [game.finished]);

    return {
        trophyId,
        playingAs: game.x_addr === oppoPubKey.toSuiAddress() ? "O" : "X",
        isXTurn,
        isMyTurn,
        gameFinished
    }
}
