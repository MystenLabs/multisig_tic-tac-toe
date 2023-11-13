import { useNavigate, useParams } from 'react-router-dom';
import { useWalletKit } from '@mysten/wallet-kit';
import { useGame } from '../hooks/useGame';
import { ed25519PublicKeyB64 } from '../helpers/keys';

function Game() {
    const { currentAccount } = useWalletKit();
    const { oppoPubKey, gameId } = useParams<{ oppoPubKey: string, gameId: string }>();
    const navigate = useNavigate();

    // REVIEW is this good practice?
    // There shouldn't be the case that either oppoPubKey or gameId are empty now.
    if (!oppoPubKey || !gameId) {
        navigate('/');
    }
    const oppoPubKeyAsStr = oppoPubKey as string;
    const gameIdAsStr = gameId as string;

    const {
        handleClick,
        renderSquare,
        getCurrentTurnText,
        getFinishedText,
    } = useGame({ oppoPubKey: oppoPubKeyAsStr, gameId: gameIdAsStr });

    return (
        <div className='text-center flex flex-col w-full items-center'>
            <h1>{getCurrentTurnText()}</h1>
            <div className='text-left'>
                <p>
                    My Public Key: {currentAccount && ed25519PublicKeyB64(currentAccount.publicKey)}<br />
                    (Share it with opponent to join game)</p>
                <p>Game ID: {gameId}</p>
            </div>
            <table className="border-collapse">
                <tbody>
                    {Array(3)
                        .fill(null)
                        .map((_, row) => (
                            <tr key={row} >
                                {Array(3)
                                    .fill(null)
                                    .map((_, col) => {
                                        const index = row * 3 + col;
                                        return (<td
                                            className="border-2 border-solid w-20 h-20 font-sans text-6xl"
                                            id={index.toString()}
                                            key={col}
                                            onClick={handleClick}>
                                            {renderSquare(index)}
                                        </td>);
                                    })}
                            </tr>
                        ))}
                </tbody>
            </table>
            <div className="text-center">{getFinishedText()}</div>
        </div>
    );
}

export default Game;
