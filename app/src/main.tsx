import "bootstrap/dist/css/bootstrap.min.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { WalletKitProvider } from "@mysten/wallet-kit";
import { router } from "./routes/index.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletKitProvider>
      <RouterProvider router={router} />
    </WalletKitProvider>
  </React.StrictMode>
);
