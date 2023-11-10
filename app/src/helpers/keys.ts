import { Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { MultiSigPublicKey } from "@mysten/sui.js/multisig";
import { SIGNATURE_SCHEME_TO_FLAG } from "@mysten/sui.js/cryptography";
import { toB64 } from "@mysten/bcs";

export function ed25519PublicKeyB64(pk: Uint8Array) {
    const pkNew = new Uint8Array([SIGNATURE_SCHEME_TO_FLAG["ED25519"], ...pk]);
    return toB64(pkNew);
}

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

