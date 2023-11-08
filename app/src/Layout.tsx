import { ConnectButton, useWalletKit } from "@mysten/wallet-kit";
import { Outlet } from "react-router-dom";

export const Layout = () => {
  const { currentAccount } = useWalletKit();
  return (
    <div className="tw-space-y-2">
      <div className="tw-p-2 tw-bg-gray-100 tw-flex tw-flex-row tw-w-full tw-justify-between tw-items-center">
        <div className="tw-text-xl">Multisig Tic Tac Toe</div>
        {!!currentAccount?.address && <ConnectButton />}
      </div>
      <Outlet />
    </div>
  );
};
