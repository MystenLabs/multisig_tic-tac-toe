import { useCreateOrJoinGame } from "../hooks/useCreateOrJoinGame";
import "../../tailwind.css";
import { useWalletKit } from "@mysten/wallet-kit";

function CreateOrJoinGame() {
  const { currentAccount } = useWalletKit();

  const {
    opponentPubKey,
    opponentValid,
    handleOpponentChange,
    handleCreateGame,
    handleJoinGame,
    ed25519PublicKeyB64,
  } = useCreateOrJoinGame();

  return (
    <>
      <div className="tw-space-y-4 tw-w-full tw-space-x-4 tw-flex tw-flex-col tw-items-center">
        <h2 className="tw-text-center">Open game</h2>
        <p>
          My Public Key:{" "}
          {currentAccount && ed25519PublicKeyB64(currentAccount.publicKey)}
          <br />
          (Share it with opponent to join game)
        </p>
        <div className="tw-w-1/2 ">
          <label htmlFor="opponent" className="form-label">
            Opponent Ed25519 Public Key
          </label>
          <input
            id="opponent"
            type="text"
            className="form-control"
            value={opponentPubKey}
            onChange={handleOpponentChange}
          />
          <div className="tw-space-x-4 tw-mt-4">
            <button
              className="btn btn-primary"
              onClick={handleCreateGame}
              disabled={!opponentValid}
            >
              Create Game (as X)
            </button>
            <button
              className="btn btn-secondary"
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
