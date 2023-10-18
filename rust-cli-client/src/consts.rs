use sui_types::base_types::ObjectID;

pub const SUI_FULLNODE_URL: &str = "https://rpc.testnet.sui.io:443";
pub const PACKAGE_ID: ObjectID = ObjectID::new([
    0xed, 0x6e, 0x4b, 0x08, 0x4c, 0xde, 0x61, 0x4f, 0x92, 0xaf, 0xc0, 0xe0, 0x81, 0xfc, 0xb3, 0x58,
    0xeb, 0xa8, 0x4c, 0x5e, 0x6f, 0xfd, 0x07, 0xca, 0x48, 0x98, 0x38, 0x61, 0xc0, 0xc1, 0xc5, 0xe1,
]);
pub const MODULE_NAME: &str = "multisig_tic_tac_toe";
pub const TIC_TAC_TOE_STRUCT_NAME: &str = "TicTacToe";
pub const MARK_STRUCT_NAME: &str = "Mark";

pub const TX_GAS_BUDGET: u64 = 10_000_000;