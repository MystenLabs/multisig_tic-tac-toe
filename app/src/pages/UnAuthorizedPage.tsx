import { ConnectButton } from "@mysten/wallet-kit";

export const UnAuthorizedPage = () => {
  return (
    <div className="mt-4 flex flex-col w-full items-center">
      <h1>Welcome to Multisig Tic-Tac-Toe</h1>
      <ConnectButton
        connectText="Connect Wallet"
        connectedText="Wallet Connected"
      />
    </div>
  );
};
