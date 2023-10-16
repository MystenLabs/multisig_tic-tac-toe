import { Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { MultiSigPublicKey } from "@mysten/sui.js/multisig";

export const PACKAGE_ADDRESS="0xed6e4b084cde614f92afc0e081fcb358eba84c5e6ffd07ca48983861c0c1c5e1";
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

