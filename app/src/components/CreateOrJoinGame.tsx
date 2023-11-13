import "../../tailwind.css";
import { ed25519PublicKeyB64 } from "../helpers/keys";
import { useCreateOrJoinGame } from "../hooks/useCreateOrJoinGame";
import { useWalletKit } from "@mysten/wallet-kit";

function CreateOrJoinGame() {
  const { currentAccount } = useWalletKit();

  const {
    opponentPubKey,
    opponentValid,
    handleOpponentChange,
    handleCreateGame,
    handleJoinGame,
  } = useCreateOrJoinGame();

  return (
    <>
      <div className="space-y-4 w-full space-x-4 flex flex-col items-center">
        <h2 className="text-center">Open game</h2>
        <p>
          My Public Key:{" "}
          {currentAccount && ed25519PublicKeyB64(currentAccount.publicKey)}
          <br />
          (Share it with opponent to join game)
        </p>
        <div className="w-1/2 ">
          <label htmlFor="opponent" className="block text-gray-700 text-sm font-bold mb-2">
            Opponent Ed25519 Public Key
          </label>
          <input
            id="opponent"
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={opponentPubKey}
            onChange={handleOpponentChange}
          />
          <div className="space-x-4 mt-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={handleCreateGame}
              disabled={!opponentValid}
            >
              Create Game (as X)
            </button>
            <button
              className="bg-transparent hover:bg-blue-700 text-blue-500 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded"
              onClick={handleJoinGame}
              disabled={!opponentValid}
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default CreateOrJoinGame;
