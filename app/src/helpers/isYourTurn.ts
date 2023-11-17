import { MoveStructGame } from "../types/game-move";

interface IsYourTurnProps {
  game?: MoveStructGame;
  currentAddress?: string;
}

export function isYourTurn({ game, currentAddress }: IsYourTurnProps) {
  if (!game || !currentAddress) {
    return false;
  }
  return (game.x_addr === currentAddress) === (game.cur_turn%2 === 0);
}
