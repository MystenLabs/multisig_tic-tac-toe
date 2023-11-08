import { ConnectButton } from "@mysten/wallet-kit";
import { Outlet } from "react-router-dom";

export const Layout = () => {
  return (
    <>
      <ConnectButton />
      <Outlet />
    </>
  );
};
