import { useNavigate, useParams } from "react-router-dom";
import { useWalletKit } from "@mysten/wallet-kit";
import { useGame } from "../hooks/useGame";
import { ed25519PublicKeyB64 } from "../helpers/keys";
import { FinishedGameText } from "../components/FinishedGameText";
import { GameCurrentTurnText } from "../components/GameCurrentTurnText";

// TODO: getCurrentTurnText can become a separate component that takes as props the Game state
// TODO: getFinishedText can become a separate component that takes as props the Game state

function Game() {
  const { currentAccount } = useWalletKit();
  const { oppoPubKey, gameId } = useParams<{
    oppoPubKey: string;
    gameId: string;
  }>();
  const navigate = useNavigate();

  // Just to be safe
  // There shouldn't be the case that either oppoPubKey or gameId are empty now.
  if (!oppoPubKey || !gameId) {
    navigate("/");
  }

  const { game, handleClick, getFinishedText } = useGame({
    oppoPubKey: oppoPubKey!,
    gameId: gameId!,
  });

  if (!game) {
    return <div>Game was not found.</div>;
  }

  return (
    <div className="text-center flex flex-col w-full items-center">
      <GameCurrentTurnText game={game} />
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
      <div className="text-center">{getFinishedText()}</div>
      {/* <FinishedGameText game={game} /> */}
    </div>
  );
}

export default Game;
