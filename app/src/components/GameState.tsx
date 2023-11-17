import { MoveStructGame } from "../types/game-move";
import { useGameState } from "../hooks/useGameState";

// REVIEW: only this now: deleteGame is also signalling if delete is available
export default function GameState(args: { game: MoveStructGame, oppoPubKeyB64: string, deleteGame?: () => Promise<void> }) {
    const { game, deleteGame } = args;
    const {
        trophyId,
        playingAs,
        isXTurn,
        isMyTurn,
        gameFinished
    } = useGameState(args);


    if (!gameFinished) {
        return <>
            <div>Playing as {playingAs}</div>
            <div>Current turn: {isXTurn ? "X" : "O"}</div>
            <div>{isMyTurn ? "Make your move" : "Waiting for opponent's move"}</div>
        </>
    }

    function onDeleteClicked() {
        deleteGame!()
    }

    return <>
        <div className="pt-4">{(game.finished === 1) === (playingAs === "X") ? "You won!" : "You lost..."}</div>
        {trophyId && <a href={`https://suiexplorer.com/object/${trophyId}?network=testnet`}>Trophy</a>}

        {game && deleteGame &&
            <div className="pt-4">
                <button
                    type="button"
                    className="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900"
                    onClick={onDeleteClicked}
                >
                    Delete Game Object
                </button>
            </div>
        }
    </>


}
