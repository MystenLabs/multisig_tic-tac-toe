use std::path::PathBuf;
use std::str::FromStr;

use anyhow::{anyhow, Result};
use fastcrypto::encoding::{Base64, Encoding};
use move_core_types::language_storage::StructTag;
use serde::Serialize;

use shared_crypto::intent::{Intent, IntentMessage};
use sui_keys::keystore::{AccountKeystore, FileBasedKeystore, Keystore};
use sui_sdk::apis::ReadApi;
use sui_sdk::json::SuiJsonValue;
use sui_sdk::rpc_types::{
    SuiData, SuiObjectDataFilter, SuiObjectDataOptions, SuiObjectResponseQuery,
    SuiTransactionBlockResponse, SuiTransactionBlockResponseOptions,
};
use sui_sdk::{SuiClient, SuiClientBuilder};
use sui_transaction_builder::DataReader;
use sui_types::base_types::{ObjectID, ObjectRef, SuiAddress};
use sui_types::crypto::{EncodeDecodeBase64, PublicKey, ToFromBytes};
use sui_types::gas_coin::GasCoin;
use sui_types::multisig::{MultiSig, MultiSigPublicKey};
use sui_types::programmable_transaction_builder::ProgrammableTransactionBuilder;
use sui_types::quorum_driver_types::ExecuteTransactionRequestType;
use sui_types::signature::GenericSignature;
use sui_types::transaction::{ProgrammableTransaction, Transaction, TransactionData};
use sui_types::Identifier;

const TX_GAS_BUDGET: u64 = 10_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub enum RowCol {
    #[serde(rename = "0")]
    First,
    #[serde(rename = "1")]
    Second,
    #[serde(rename = "2")]
    Third,
}

// TODO crosscheck: I thought the PublicKey can be extracted from SuiAddress, however after some
// search in sui, I could not find such a function. I presume SuiAddress is independent of
// PublicKey
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SuiWeb3Player {
    pub address: SuiAddress,
    pub pub_key: PublicKey,
}

pub struct SuiConfig {
    pub sui_client: SuiClient,
    pub keystore: Keystore,
    pub my_address: SuiAddress,
    pub opponent: SuiWeb3Player,
    pub package_id: ObjectID,
}

impl SuiConfig {
    fn default_keystore_path() -> PathBuf {
        match dirs::home_dir() {
            Some(v) => v.join(".sui").join("sui_config").join("sui.keystore"),
            None => panic!("Cannot obtain home directory path"),
        }
    }

    pub async fn new_from_env() -> Result<Self> {
        dotenvy::dotenv().ok();
        let rpc_server_url = std::env::var("PROVIDER")?;
        let keystore_path = match std::env::var("KEYSTORE_PATH") {
            Ok(path) => PathBuf::from_str(&path)?,
            Err(_) => Self::default_keystore_path(),
        };
        let my_address = SuiAddress::from_str(&std::env::var("MY_ADDRESS")?)?;
        let opponent_address = SuiAddress::from_str(&std::env::var("OPPONENT_ADDRESS")?)?;
        let opponent_pub_key = PublicKey::from_str(&std::env::var("OPPONENT_PUBLIC_KEY")?)
            .map_err(|e| anyhow!("Cannot parse opponent public key: {}", e))?;
        let package_id = ObjectID::from_str(&std::env::var("PACKAGE_ID")?)?;

        let sui_client = SuiClientBuilder::default().build(rpc_server_url).await?;
        let keystore = Keystore::File(FileBasedKeystore::new(&keystore_path)?);
        let opponent = SuiWeb3Player {
            address: opponent_address,
            pub_key: opponent_pub_key,
        };

        Ok(Self {
            sui_client,
            keystore,
            my_address,
            opponent,
            package_id,
        })
    }

    // Copied from TransactionBuilder in sui-transaction-builder.
    // Selects gas object to use
    pub async fn select_gas(
        &self,
        signer: SuiAddress,
        input_gas: Option<ObjectID>,
        budget: u64,
        exclude_objects: Vec<ObjectID>,
        // gas_price: u64,
    ) -> Result<ObjectRef> {
        // if budget < gas_price {
        //     bail!("Gas budget {budget} is less than the reference gas price {gas_price}. The gas budget must be at least the current reference gas price of {gas_price}.")
        // }
        if let Some(gas) = input_gas {
            let read_api = self.sui_client.read_api();
            read_api
                .get_object_with_options(gas, SuiObjectDataOptions::new())
                .await?
                .object_ref_if_exists()
                .ok_or(anyhow!("No object-ref"))
        } else {
            let read_api = self.sui_client.read_api();
            let gas_objs =
                <ReadApi as DataReader>::get_owned_objects(read_api, signer, GasCoin::type_())
                    .await?; // why not reference instead of move for signer?

            for obj in gas_objs {
                let response = read_api
                    .get_object_with_options(obj.object_id, SuiObjectDataOptions::new().with_bcs())
                    .await?;
                let obj = response.object()?;
                let gas: GasCoin = bcs::from_bytes(
                    &obj.bcs
                        .as_ref()
                        .ok_or_else(|| anyhow!("bcs field is unexpectedly empty"))?
                        .try_as_move()
                        .ok_or_else(|| anyhow!("Cannot parse move object to gas object"))?
                        .bcs_bytes,
                )?;
                if !exclude_objects.contains(&obj.object_id) && gas.value() >= budget {
                    return Ok(obj.object_ref());
                }
            }
            Err(anyhow!("Cannot find gas coin for signer address [{signer}] with amount sufficient for the required gas amount [{budget}]."))
        }
    }

    // TODO test: Seems to be working from println. But also need to test that it parses into the
    // appropriate struct
    pub async fn get_game(&self) -> Result<()> {
        let my_key = self.keystore.get_key(&self.my_address)?;
        let pub_keys = vec![my_key.public().into(), self.opponent.pub_key.clone()];

        let multisig_pk = MultiSigPublicKey::new(pub_keys, vec![1, 1], 1)?;
        // TODO crosscheck: I can create SuiAddress from PublicKey but not the other way around?
        let multisig_addr: SuiAddress = (&multisig_pk).into();

        let filter = SuiObjectDataFilter::StructType(StructTag {
            address: self.package_id.into(),
            module: Identifier::from_str("multisig_tic_tac_toe")?,
            name: Identifier::from_str("TicTacToe")?,
            type_params: vec![],
        });
        let query =
            SuiObjectResponseQuery::new(Some(filter), Some(SuiObjectDataOptions::full_content()));

        let tic_tac_toe_objs = self
            .sui_client
            .read_api()
            .get_owned_objects(multisig_addr, Some(query), None, None)
            .await?;

        println!("tic_tac_toe_objs = {:#?}", tic_tac_toe_objs);

        todo!();
    }

    pub async fn create_game(&self) -> Result<SuiTransactionBlockResponse> {
        let SuiConfig {
            sui_client,
            keystore,
            my_address: my_x_address,
            opponent,
            package_id,
        } = self;

        // 1. Produce the necessary information to work with mutlisig
        // This is equivalent to [Step
        // 2](https://docs.sui.io/learn/cryptography/sui-multisig#step-2-create-a-multisig-address) in
        // the documentation
        let my_key = keystore.get_key(&my_x_address)?;
        let pub_keys = vec![my_key.public().into(), opponent.pub_key.clone()];

        let multisig_pk = MultiSigPublicKey::new(pub_keys, vec![1, 1], 1)?;
        // TODO crosscheck: I can create SuiAddress from PublicKey but not the other way around?
        let multisig_addr = (&multisig_pk).into();
        // 1. End

        // 2. Create the transaction
        let mut builder = ProgrammableTransactionBuilder::new();
        sui_client
            .transaction_builder()
            .single_move_call(
                &mut builder,
                package_id.clone(),
                "multisig_tic_tac_toe",
                "create_game",
                vec![],
                vec![
                    SuiJsonValue::from_str(&my_x_address.to_string())?,
                    SuiJsonValue::from_str(&opponent.address.to_string())?,
                ],
            )
            .await?;
        let pt: ProgrammableTransaction = builder.finish();

        // TODO refactor: Maybe it is worth storing gas_price in SuiConfig
        let gas_price = sui_client.read_api().get_reference_gas_price().await?;
        let gas_ref = self
            .select_gas(my_x_address.clone(), None, TX_GAS_BUDGET, vec![])
            .await?;

        let tx_data = TransactionData::new_programmable_allow_sponsor(
            multisig_addr,
            vec![gas_ref],
            pt,
            TX_GAS_BUDGET,
            gas_price,
            my_x_address.clone(), // why not reference instead of move?
        );
        // 2. End

        // 3. "Serialize" the transaction
        // In order to sign the tx for use in multisig we will need to convert it to raw bytes first.
        // This is equivalent to [Step
        // 3](https://docs.sui.io/learn/cryptography/sui-multisig#step-3-serialize-any-transaction) in
        // the documentation (Note that there are two Step 3)
        let tx_bytes = Base64::encode(bcs::to_bytes(&tx_data)?);

        // TODO question: Shouldn't we use sui_app() insteadof sui_transaction()?
        let intent = Intent::sui_transaction();
        let msg: TransactionData = bcs::from_bytes(
            &Base64::decode(&tx_bytes)
                .map_err(|e| anyhow!("Cannot deserialize data as TransactionData {:?}", e))?,
        )?;
        let intent_msg = IntentMessage::new(intent, msg);
        // for debugging: maybe also use a verbose mode?
        // let raw_intent_msg: String = Base64::encode(bcs::to_bytes(&intent_msg)?);
        // let mut hasher: Blake2b256 = Blake2b256::default();
        // hasher.update(bcs::to_bytes(&intent_msg)?);
        // let digest = hasher.finalize().digest;
        // for debugging end
        // 3. End

        // 4. Sign the transaction as my_address.
        // This is equivalent to [Step
        // 4](https://docs.sui.io/learn/cryptography/sui-multisig#step-4-sign-the-transaction-with-two-keys)
        // in the documentation
        // Note that in our case we are also going to need this signature **both** for creating the
        // multisig **and** for sponsoring the tx.
        let my_signature = keystore
            .sign_secure(&my_x_address, &intent_msg.value, intent_msg.intent)
            .map_err(|e| anyhow!(e))?;
        // 4. End

        // 5. Convert my_signature to multisig
        // This is equivalent to [Step
        // 5](https://docs.sui.io/learn/cryptography/sui-multisig#step-5-combine-individual-signatures-into-a-multisig)
        // in the documentation.
        let multisig = MultiSig::combine(vec![my_signature.clone()], multisig_pk)
            .expect("Expected combination");
        let generic_sig: GenericSignature = multisig.into();
        let multisig_serialized = generic_sig.encode_base64();
        // 5. End

        // 6. Convert serialized transaction to TransactionData
        let tx_data = bcs::from_bytes(
            &Base64::try_from(tx_bytes)
                .map_err(|e| anyhow!(e))?
                .to_vec()
                .map_err(|e| anyhow!(e))?,
        )?;
        // 6. End

        // 7. Sign data using both the multisig and my_signature as we need to sponsor it.
        let sigs = vec![
            GenericSignature::Signature(my_signature), // For sponsoring
            GenericSignature::from_bytes(
                &Base64::try_from(multisig_serialized) // For signing as multisig account
                    .map_err(|e| anyhow!(e))?
                    .to_vec()
                    .map_err(|e| anyhow!(e))?,
            )
            .map_err(|e| anyhow!(e))?,
        ];
        let transaction =
            Transaction::from_generic_sig_data(tx_data, Intent::sui_transaction(), sigs);
        // 7. End

        // 8. Execute the transaction.
        sui_client
            .quorum_driver_api()
            .execute_transaction_block(
                transaction,
                SuiTransactionBlockResponseOptions::new()
                .with_effects()
                .with_events()
                .with_input()
                .with_events()
                .with_object_changes()
                .with_balance_changes(),
                Some(sui_types::quorum_driver_types::ExecuteTransactionRequestType::WaitForLocalExecution),
                )
            .await
            .map_err(|e| anyhow!(e))
    }

    pub async fn send_mark_to_game(
        &self,
        mark_id: ObjectID,
        row: RowCol,
        col: RowCol,
    ) -> Result<SuiTransactionBlockResponse> {
        let SuiConfig {
            sui_client,
            keystore: _,
            my_address,
            opponent: _,
            package_id,
        } = self;

        // Create the transaction
        let send_mark_call = sui_client
            .transaction_builder()
            .move_call(
                *my_address,
                *package_id,
                "multisig_tic_tac_toe",
                "send_mark_to_game",
                vec![],
                vec![
                    SuiJsonValue::from_object_id(mark_id),
                    SuiJsonValue::new(serde_json::to_value(row)?)?,
                    SuiJsonValue::new(serde_json::to_value(col)?)?,
                ],
                None,
                TX_GAS_BUDGET,
            )
            .await?;

        // Sign transaction.
        let signature =
            self.keystore
                .sign_secure(&my_address, &send_mark_call, Intent::sui_transaction())?;

        // Execute the transaction.
        sui_client
            .quorum_driver_api()
            .execute_transaction_block(
                Transaction::from_data(send_mark_call, Intent::sui_transaction(), vec![signature]),
                SuiTransactionBlockResponseOptions::new().with_effects(),
                Some(ExecuteTransactionRequestType::WaitForLocalExecution),
            )
            .await
            .map_err(|e| anyhow!(e))
    }

    pub async fn place_mark(
        &self,
        game_id: ObjectID,
        mark_id: ObjectID,
    ) -> Result<SuiTransactionBlockResponse> {
        let SuiConfig {
            sui_client,
            keystore,
            my_address: my_x_address,
            opponent,
            package_id,
        } = self;

        let my_key = keystore.get_key(&my_x_address)?;
        let pub_keys = vec![my_key.public().into(), opponent.pub_key.clone()];

        let multisig_pk = MultiSigPublicKey::new(pub_keys, vec![1, 1], 1)?;
        let multisig_addr = (&multisig_pk).into();

        let mut builder = ProgrammableTransactionBuilder::new();
        sui_client
            .transaction_builder()
            .single_move_call(
                &mut builder,
                package_id.clone(),
                "multisig_tic_tac_toe",
                "place_mark",
                vec![],
                vec![
                    SuiJsonValue::from_object_id(game_id),
                    SuiJsonValue::from_object_id(mark_id),
                ],
            )
            .await?;
        let pt: ProgrammableTransaction = builder.finish();

        let gas_price = sui_client.read_api().get_reference_gas_price().await?;
        let gas_ref = self
            .select_gas(my_x_address.clone(), None, TX_GAS_BUDGET, vec![])
            .await?;

        let tx_data = TransactionData::new_programmable_allow_sponsor(
            multisig_addr,
            vec![gas_ref],
            pt,
            TX_GAS_BUDGET,
            gas_price,
            my_x_address.clone(), // why not reference instead of move?
        );

        let tx_bytes = Base64::encode(bcs::to_bytes(&tx_data)?);

        let intent = Intent::sui_transaction();
        let msg: TransactionData = bcs::from_bytes(
            &Base64::decode(&tx_bytes)
                .map_err(|e| anyhow!("Cannot deserialize data as TransactionData {:?}", e))?,
        )?;
        let intent_msg = IntentMessage::new(intent, msg);

        let my_signature = keystore
            .sign_secure(&my_x_address, &intent_msg.value, intent_msg.intent)
            .map_err(|e| anyhow!(e))?;

        let multisig = MultiSig::combine(vec![my_signature.clone()], multisig_pk)
            .expect("Expected combination");
        let generic_sig: GenericSignature = multisig.into();
        let multisig_serialized = generic_sig.encode_base64();

        let tx_data = bcs::from_bytes(
            &Base64::try_from(tx_bytes)
                .map_err(|e| anyhow!(e))?
                .to_vec()
                .map_err(|e| anyhow!(e))?,
        )?;

        let sigs = vec![
            GenericSignature::Signature(my_signature), // For sponsoring
            GenericSignature::from_bytes(
                &Base64::try_from(multisig_serialized) // For signing as multisig account
                    .map_err(|e| anyhow!(e))?
                    .to_vec()
                    .map_err(|e| anyhow!(e))?,
            )
            .map_err(|e| anyhow!(e))?,
        ];
        let transaction =
            Transaction::from_generic_sig_data(tx_data, Intent::sui_transaction(), sigs);

        sui_client
            .quorum_driver_api()
            .execute_transaction_block(
                transaction,
                SuiTransactionBlockResponseOptions::new()
                .with_effects()
                .with_events()
                .with_input()
                .with_events()
                .with_object_changes()
                .with_balance_changes(),
                Some(sui_types::quorum_driver_types::ExecuteTransactionRequestType::WaitForLocalExecution),
                )
            .await
            .map_err(|e| anyhow!(e))
    }
}
