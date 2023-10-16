import {
    Routes, Route,
} from 'react-router-dom';
import Game from './components/Game';
import CreateOrJoinGame from './components/CreateOrJoinGame';
import { ConnectButton, useWalletKit } from '@mysten/wallet-kit';
import { useEffect, useState } from 'react';
import '../tailwind.css';

function App() {
    const { status, currentAccount } = useWalletKit();
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        console.log(status);
        if (status === "CONNECTED" && currentAccount) {
            setConnected(true);
        }
        console.log(currentAccount?.address);
    }, [status, currentAccount]);

    return (
        <>
            {!connected ? (
                <div className='mt-4 tw-flex tw-flex-col tw-w-full tw-items-center'>
                    <h1>Welcome to Multisig Tic-Tac-Toe</h1>
                    <ConnectButton
                        connectText="Connect Wallet"
                        connectedText="Wallet Connected"
                    />
                </div>
            ) : (
                <Routes>
                    <Route path="/game/:oppoPubKey/:gameId" element={<Game />} />
                    <Route path="/" element={<CreateOrJoinGame />} />
                </Routes>
            )}
        </>
    );
}

export default App;
