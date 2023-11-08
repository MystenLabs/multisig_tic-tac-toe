import { useWalletKit } from "@mysten/wallet-kit";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { UnAuthorizedPage } from "./pages/UnAuthorizedPage";

export const AuthenticationRouter = () => {
  const { status, currentAccount } = useWalletKit();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    console.log(status);
    if (status === "CONNECTED" && currentAccount) {
      setConnected(true);
    }
    else {
      setConnected(false);
    }
    console.log(currentAccount?.address);
  }, [status, currentAccount]);

  if (connected) {
    return <Outlet />;
  } else {
    return <UnAuthorizedPage />;
  }
};
