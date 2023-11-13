import { ConnectButton, useWalletKit } from "@mysten/wallet-kit";
import { Outlet } from "react-router-dom";

export const Layout = () => {
  const { currentAccount } = useWalletKit();
  return (
    <div className="space-y-2">
      <div className="p-2 bg-gray-100 flex flex-row w-full justify-between items-center">
        <div className="text-xl">Multisig Tic Tac Toe</div>
        {!!currentAccount?.address && <ConnectButton />}
      </div>
      <Outlet />
    </div>
  );
};
