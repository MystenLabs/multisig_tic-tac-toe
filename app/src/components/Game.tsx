import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWalletKit } from '@mysten/wallet-kit';
import { useGame } from '../hooks/useGame';
import { ed25519PublicKeyB64 } from '../helpers/keys';

function Game() {
    const { currentAccount } = useWalletKit();
    const { oppoPubKey, gameId } = useParams<{ oppoPubKey: string, gameId: string }>();
    const navigate = useNavigate();

    // REVIEW is this correct?
    // There shouldn't be the case that either oppoPubKey or gameId are empty now.
    if (!oppoPubKey || !gameId) {
        navigate('/');
    }
    const oppoPubKeyAsStr = oppoPubKey as string;
    const gameIdAsStr = gameId as string;

    const {
        handleClick,
        renderSquare,
        updateGameState,
        getCurrentTurnText,
        getFinishedText,
    } = useGame({ oppoPubKey: oppoPubKeyAsStr, gameId: gameIdAsStr });

    // REVIEW
    // Poll the blockchain every 1 sec
    useEffect(() => {
        // Create an interval that updates the state every 1 second
        const intervalId = setInterval(() => {
            updateGameState();
        }, 1000); // 1000 milliseconds = 1 second

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once

    return (
        <div className='tw-text-center tw-flex tw-flex-col tw-w-full tw-items-center'>
            <h1>{getCurrentTurnText()}</h1>
            <div className='tw-text-left'>
                <p>
                    My Public Key: {currentAccount && ed25519PublicKeyB64(currentAccount.publicKey)}<br />
                    (Share it with opponent to join game)</p>
                <p>Game ID: {gameId}</p>
            </div>
            <table>
                <tbody>
                    {Array(3)
                        .fill(null)
                        .map((_, row) => (
                            <tr key={row} className="board-row">
                                {Array(3)
                                    .fill(null)
                                    .map((_, col) => {
                                        const index = row * 3 + col;
                                        return (<td
                                            className='tw-border tw-w-20 tw-h-20 tw-text-6xl tw-text-center'
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
            <div className='tw-text-center'>{getFinishedText()}</div>
        </div>
    );
}

export default Game;
