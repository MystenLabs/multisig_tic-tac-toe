import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { WalletKitProvider } from "@mysten/wallet-kit";
import { router } from "./routes/index.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
    // <React.StrictMode>
        <WalletKitProvider>
            <RouterProvider router={router} />
            <Toaster position="bottom-center" />
        </WalletKitProvider>
    // </React.StrictMode>
);
