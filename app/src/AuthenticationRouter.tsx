import { Outlet } from "react-router-dom";
import { UnAuthorizedPage } from "./pages/UnAuthorizedPage";
import { useEffect, useState } from "react";
import { useWalletKit } from "@mysten/wallet-kit";

export const AuthenticationRouter = () => {
    const { status, currentAccount } = useWalletKit();
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        setConnected(status === "CONNECTED" && !!currentAccount);
    }, [status, currentAccount]);

    if (!connected) {
        return <UnAuthorizedPage />;
    }
    return <Outlet />;
};
