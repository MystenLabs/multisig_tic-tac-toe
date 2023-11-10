import { Outlet } from "react-router-dom";
import { UnAuthorizedPage } from "./pages/UnAuthorizedPage";
import { useEffect, useState } from "react";
import { useWalletKit } from "@mysten/wallet-kit";

export const AuthenticationRouter = () => {
  const { status, currentAccount } = useWalletKit();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (status === "CONNECTED" && currentAccount) {
      setConnected(true);
    }
    else {
      setConnected(false);
    }
  }, [status, currentAccount]);

  if (connected) {
    return <Outlet />;
  } else {
    return <UnAuthorizedPage />;
  }
};
