use shared_crypto::intent::{Intent, IntentScope};
use sui_sdk::rpc_types::SuiTransactionBlockResponseOptions;
use sui_types::quorum_driver_types::ExecuteTransactionRequestType;
use std::str::FromStr;
use sui_keys::keystore::AccountKeystore;
use sui_keys::keystore::{FileBasedKeystore, Keystore};
use sui_sdk::{
    types::{
        base_types::{ObjectID, SuiAddress},
        crypto::Signature,
    },
    SuiClient, SuiClientBuilder,
};
use sui_types::transaction::Transaction;

pub struct GameSetup<'a> {
    pub provider: &'a str,
    pub my_address: &'a str,
    pub opponent_address: &'a str,
    // TODO: Calculate multisig address automatically
    pub game_address: &'a str,
}

pub async fn start_game() -> Result<(), anyhow::Error> {
    let sui = SuiClientBuilder::default()
        .build("https://fullnode.devnet.sui.io:443")
        .await
        .unwrap();
    // Load keystore from ~/.sui/sui_config/sui.keystore
    let keystore_path = match dirs::home_dir() {
        Some(v) => v.join(".sui").join("sui_config").join("sui.keystore"),
        None => panic!("Cannot obtain home directory path"),
    };

    let my_address =
        SuiAddress::from_str("0xbcab7526033aa0e014f634bf51316715dda0907a7fab5a8d7e3bd44e634a4d44")?;
    let gas_object_id =
        ObjectID::from_str("0xe638c76768804cebc0ab43e103999886641b0269a46783f2b454e2f8880b5255")?;
    let recipient =
        SuiAddress::from_str("0x727b37454ab13d5c1dbb22e8741bff72b145d1e660f71b275c01f24e7860e5e5")?;

    // Create a sui transfer transaction
    let transfer_tx = sui
        .transaction_builder()
        .transfer_sui(my_address, gas_object_id, 1000, recipient, Some(1000))
        .await?;

    // Sign transaction
    let keystore = Keystore::from(FileBasedKeystore::new(&keystore_path)?);
    let signature = keystore.sign_secure(
        &my_address,
        &transfer_tx,
        Intent::sui_app(IntentScope::TransactionData),
    )?;

    // Execute the transaction
    let transaction_response = sui.quorum_driver_api().execute_transaction_block(
        Transaction::from_data(
            transfer_tx,
            Intent::sui_app(IntentScope::TransactionData),
            vec![signature],
        ),
        SuiTransactionBlockResponseOptions::new()
            .with_object_changes()
            .with_balance_changes()
            .with_effects()
            .with_events(),
        Some(ExecuteTransactionRequestType::WaitForLocalExecution),
    );

    println!("{:?}", transaction_response.await.expect("Transaction didn't execute"));

    Ok(())
}
