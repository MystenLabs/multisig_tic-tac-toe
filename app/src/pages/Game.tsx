import { MouseEvent } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { useWalletKit } from "@mysten/wallet-kit";
import { ed25519PublicKeyB64 } from "../helpers/keys";
import GameState from "../components/GameState";

export default function Game() {
    const { oppoPubKey, gameId } = useParams<{
        oppoPubKey: string;
        gameId: string;
    }>();
    const { currentAccount } = useWalletKit();

    // Just to be safe
    // There shouldn't be the case that either oppoPubKey or gameId are empty now.
    if (!oppoPubKey || !gameId) {
        throw new Error("Invalid URL");
    }
    const { game, placeMark, deleteGame } = useGame({ gameId, oppoPubKey });

    async function handleClick(e: MouseEvent) {
        const placement = parseInt((e.target as HTMLElement).id);
        await placeMark(placement);
    }

    return (
        <div className="text-center flex flex-col w-full items-center">
            <div className="text-left">
                <p>
                    My Public Key:{" "}
                    {currentAccount && ed25519PublicKeyB64(currentAccount.publicKey)}
                    <br />
                    (Share it with opponent to join game)
                </p>
                <p>Game ID: {gameId}</p>
            </div>
            <table className="border-collapse">
                <tbody>
                    {Array(3)
                        .fill(null)
                        .map((_, row) => (
                            <tr key={row}>
                                {Array(3)
                                    .fill(null)
                                    .map((_, col) => {
                                        const index = row * 3 + col;
                                        return (
                                            <td
                                                className="border-2 border-solid w-20 h-20 font-sans text-6xl"
                                                id={index.toString()}
                                                key={col}
                                                onClick={handleClick}
                                            >
                                                {game?.gameboard[index] === 1
                                                    ? "X"
                                                    : game?.gameboard[index] === 2
                                                        ? "O"
                                                        : " "}
                                            </td>
                                        );
                                    })}
                            </tr>
                        ))}
                </tbody>
            </table>
            { game && currentAccount && <GameState game={game} oppoPubKeyB64={oppoPubKey} deleteGame={deleteGame} />}
        </div>
    );
}

