import { ConnectButton, useWalletKit } from "@mysten/wallet-kit";
import { Link } from "react-router-dom";

export const NavBar = () => {
  const { currentAccount } = useWalletKit();
  return (
    <div className="p-2 bg-gray-100 flex flex-row w-full justify-between items-center">
      <Link className="text-xl no-underline text-black" to={"/"}>
        Multisig Tic Tac Toe
      </Link>
      {!!currentAccount?.address && <ConnectButton />}
    </div>
  );
};
