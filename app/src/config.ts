import { Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { MultiSigPublicKey } from "@mysten/sui.js/multisig";

export const PACKAGE_ADDRESS="0x246d9e4969a9fce684b925d6cd01aab76cdb04b8db1c3fdaec36664435680457";
export const SUI_FULLNODE_URL="https://rpc.testnet.sui.io:443";

export function multisigPubKey(pubKey1: Ed25519PublicKey, pubKey2: Ed25519PublicKey) {

    return MultiSigPublicKey.fromPublicKeys({
        threshold: 1,
        publicKeys: [
            {
                publicKey: pubKey1,
                weight: 1
            },
            {
                publicKey: pubKey2,
                weight: 1
            }
        ],
    });
}

