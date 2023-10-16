import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom';
import { WalletKitProvider } from '@mysten/wallet-kit';
import 'bootstrap/dist/css/bootstrap.min.css';


ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WalletKitProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </WalletKitProvider>
    </React.StrictMode>
)
