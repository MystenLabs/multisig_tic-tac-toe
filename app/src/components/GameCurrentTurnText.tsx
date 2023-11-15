import React, { useEffect, useState } from "react";
import { MoveStructGame } from "../types/game-move";
import { isYourTurn } from "../helpers/isYourTurn";
import { useWalletKit } from "@mysten/wallet-kit";

// TODO: fill it with the getCurrentText function body

export const GameCurrentTurnText = ({ game }: { game?: MoveStructGame }) => {
  const [text, setText] = useState<string>("");
  const { currentAccount } = useWalletKit();

  useEffect(() => {
    let text = "";
    if (!game) {
      setText("Game was not found...");
      return;
    }
    if (game?.finished !== 0) {
      setText("Game finished!");
      return;
    }
    let curTurnText = `Current turn ${game.cur_turn}: `;
    if (game.cur_turn % 2 === 0) {
      curTurnText = curTurnText.concat("X");
    } else {
      curTurnText = curTurnText.concat("O");
    }
    if (isYourTurn({ game, currentAddress: currentAccount?.address })) {
      curTurnText = curTurnText.concat(" (Your turn)");
    } else {
      curTurnText = curTurnText.concat(" (Opponents turn)");
    }
    setText(curTurnText);
  }, [game]);

  return (
    <div>
      <h1 className="text-2xl">{text}</h1>
    </div>
  );
};
