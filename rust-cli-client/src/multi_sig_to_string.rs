use sui_types::{multisig::MultiSigPublicKey, crypto::EncodeDecodeBase64};

// TODO: pub struct MultiSig1OutOf2 w/ TryFrom<MultiSigPublicKey> asserts N sigs, weights and threshold
pub trait MultiSigToString {
    fn to_string(&self) -> String;
}

impl MultiSigToString for MultiSigPublicKey {
    fn to_string(&self) -> String {
        let mut multisig_str = "[".to_string();
        for (key, weight) in self.pubkeys() {
            multisig_str.push_str(&key.encode_base64());
            multisig_str.push_str(&format!(": {}", weight));
            multisig_str.push(',');
        }
        multisig_str.pop();
        multisig_str.push(']');
        multisig_str
    }
}
