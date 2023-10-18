use std::str::FromStr;

use anyhow::{anyhow, Result};

use move_core_types::language_storage::StructTag;
use shared_crypto::intent::{Intent, IntentMessage};
use sui_sdk::apis::ReadApi;
use sui_sdk::json::SuiJsonValue;
use sui_sdk::rpc_types::{
    SuiData, SuiMoveStruct, SuiObjectData, SuiObjectDataFilter, SuiObjectDataOptions,
    SuiObjectResponseQuery, SuiParsedData, SuiParsedMoveObject, SuiTransactionBlockResponse,
    SuiTransactionBlockResponseOptions,
};
use sui_sdk::{SuiClient, SuiClientBuilder};
use sui_transaction_builder::DataReader;
use sui_types::base_types::{ObjectID, ObjectRef, SuiAddress};
use sui_types::crypto::{EncodeDecodeBase64, Signature, SuiKeyPair};
use sui_types::gas_coin::GasCoin;
use sui_types::multisig::{MultiSig, MultiSigPublicKey};
use sui_types::object::Owner;
use sui_types::programmable_transaction_builder::ProgrammableTransactionBuilder;
use sui_types::quorum_driver_types::ExecuteTransactionRequestType;
use sui_types::signature::GenericSignature;
use sui_types::transaction::{Transaction, TransactionData};
use sui_types::Identifier;

use crate::consts::{
    MARK_STRUCT_NAME, MODULE_NAME, PACKAGE_ID, SUI_FULLNODE_URL, TIC_TAC_TOE_STRUCT_NAME,
    TX_GAS_BUDGET,
};
use crate::contract_structs::{Mark, TicTacToe};
use crate::multi_sig_to_string::MultiSigToString;
use crate::row_col::{Col, Row};

pub struct TicTacToeClient(SuiClient);

impl TicTacToeClient {
    // =========================== Constructor ============================
    pub async fn new(url: Option<&str>) -> Result<Self> {
        let url = url.unwrap_or(SUI_FULLNODE_URL);
        let client = SuiClientBuilder::default().build(url).await?;
        Ok(Self(client))
    }

    // ============================= Util fns =============================

    // Copied from TransactionBuilder in sui-transaction-builder.
    // Selects gas object to use
    pub async fn select_gas(
        &self,
        signer_addr: SuiAddress,
        input_gas: Option<ObjectID>,
        budget: u64,
        exclude_objects: Vec<ObjectID>,
        // gas_price: u64,
    ) -> Result<ObjectRef> {
        // if budget < gas_price {
        //     bail!("Gas budget {budget} is less than the reference gas price {gas_price}. The gas budget must be at least the current reference gas price of {gas_price}.")
        // }
        if let Some(gas) = input_gas {
            let read_api = self.0.read_api();
            read_api
                .get_object_with_options(gas, SuiObjectDataOptions::new())
                .await?
                .object_ref_if_exists()
                .ok_or(anyhow!("No object-ref"))
        } else {
            let read_api = self.0.read_api();
            let gas_objs =
                <ReadApi as DataReader>::get_owned_objects(read_api, signer_addr, GasCoin::type_())
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
            Err(anyhow!("Cannot find gas coin for signer address [{signer_addr}] with amount sufficient for the required gas amount [{budget}]."))
        }
    }

    // ========================== Contract calls ==========================

    pub async fn create_game(
        &self,
        signer: &SuiKeyPair,
        multisig_pub_key: MultiSigPublicKey,
        gas_ref: Option<ObjectRef>,
    ) -> Result<SuiTransactionBlockResponse> {
        let gas_ref = match gas_ref {
            Some(g) => g,
            None => {
                self.select_gas(
                    SuiAddress::from(&signer.public()),
                    None,
                    TX_GAS_BUDGET,
                    vec![],
                )
                .await?
            }
        };

        let pubkeys = multisig_pub_key.pubkeys();
        // TODO: pub struct MultiSig1OutOf2 w/ TryFrom<MultiSigPublicKey> asserts N sigs, weights and threshold
        if pubkeys.len() != 2 {
            return Err(anyhow!("Incorrect number of pubkeys in multisig"));
        }
        let x_pub_key = &pubkeys[0].0;
        let x_addr = SuiAddress::from(x_pub_key);
        let o_pub_key = &pubkeys[1].0;
        let o_addr = SuiAddress::from(o_pub_key);

        let mut builder = ProgrammableTransactionBuilder::new();
        self.0
            .transaction_builder()
            .single_move_call(
                &mut builder,
                PACKAGE_ID,
                MODULE_NAME,
                "create_game",
                vec![],
                vec![
                    SuiJsonValue::from_str(&x_addr.to_string())?,
                    SuiJsonValue::from_str(&o_addr.to_string())?,
                ],
            )
            .await?;
        let pt = builder.finish();

        let gas_price = self.0.read_api().get_reference_gas_price().await?;
        let tx_data = TransactionData::new_programmable_allow_sponsor(
            SuiAddress::from(&multisig_pub_key),
            vec![gas_ref],
            pt,
            TX_GAS_BUDGET,
            gas_price,
            SuiAddress::from(&signer.public()),
        );

        let intent = Intent::sui_transaction();
        let signer_sig =
            Signature::new_secure(&IntentMessage::new(intent.clone(), &tx_data), signer);
        let multisig_generic_sig: GenericSignature =
            MultiSig::combine(vec![signer_sig.clone()], multisig_pub_key)?.into();
        let sigs = vec![
            GenericSignature::Signature(signer_sig),
            multisig_generic_sig,
        ];
        let transaction = Transaction::from_generic_sig_data(tx_data, intent, sigs);

        self.0
            .quorum_driver_api()
            .execute_transaction_block(
                transaction,
                SuiTransactionBlockResponseOptions::new()
                    .with_effects()
                    .with_events()
                    .with_input()
                    .with_object_changes()
                    .with_balance_changes(),
                Some(ExecuteTransactionRequestType::WaitForLocalExecution),
            )
            .await
            .map_err(|e| anyhow!(e))
    }

    pub async fn send_mark_to_game(
        &self,
        signer: &SuiKeyPair,
        mark_id: ObjectID,
        row: Row,
        col: Col,
    ) -> Result<SuiTransactionBlockResponse> {
        let signer_addr = SuiAddress::from(&signer.public());
        let send_mark_call = self
            .0
            .transaction_builder()
            .move_call(
                signer_addr,
                PACKAGE_ID,
                MODULE_NAME,
                "send_mark_to_game",
                vec![],
                vec![
                    SuiJsonValue::from_object_id(mark_id),
                    SuiJsonValue::new(serde_json::to_value(Into::<u8>::into(row))?)?,
                    SuiJsonValue::new(serde_json::to_value(Into::<u8>::into(col))?)?,
                ],
                None,
                TX_GAS_BUDGET,
            )
            .await?;

        let intent = Intent::sui_transaction();
        let sig =
            Signature::new_secure(&IntentMessage::new(intent.clone(), &send_mark_call), signer);

        self.0
            .quorum_driver_api()
            .execute_transaction_block(
                Transaction::from_data(send_mark_call, intent, vec![sig]),
                SuiTransactionBlockResponseOptions::new().with_effects(),
                Some(ExecuteTransactionRequestType::WaitForLocalExecution),
            )
            .await
            .map_err(|e| anyhow!(e))
    }

    pub async fn place_mark(
        &self,
        signer: &SuiKeyPair,
        multisig_pub_key: MultiSigPublicKey,
        gas_ref: Option<ObjectRef>,
        game_id: ObjectID,
        mark_id: ObjectID,
    ) -> Result<SuiTransactionBlockResponse> {
        let gas_ref = match gas_ref {
            Some(g) => g,
            None => {
                self.select_gas(
                    SuiAddress::from(&signer.public()),
                    None,
                    TX_GAS_BUDGET,
                    vec![],
                )
                .await?
            }
        };

        // TODO: pub struct MultiSig1OutOf2 w/ TryFrom<MultiSigPublicKey> asserts N sigs, weights and threshold
        debug_assert!(
            multisig_pub_key.pubkeys().len() == 2,
            "Incorrect number of pubkeys in multisig"
        );

        let mut builder = ProgrammableTransactionBuilder::new();
        self.0
            .transaction_builder()
            .single_move_call(
                &mut builder,
                PACKAGE_ID,
                MODULE_NAME,
                "place_mark",
                vec![],
                vec![
                    SuiJsonValue::from_object_id(game_id),
                    SuiJsonValue::from_object_id(mark_id),
                ],
            )
            .await?;
        let pt = builder.finish();

        let gas_price = self.0.read_api().get_reference_gas_price().await?;
        let tx_data = TransactionData::new_programmable_allow_sponsor(
            SuiAddress::from(&multisig_pub_key),
            vec![gas_ref],
            pt,
            TX_GAS_BUDGET,
            gas_price,
            SuiAddress::from(&signer.public()),
        );

        let intent = Intent::sui_transaction();
        let signer_sig =
            Signature::new_secure(&IntentMessage::new(intent.clone(), &tx_data), signer);
        let multisig_generic_sig: GenericSignature =
            MultiSig::combine(vec![signer_sig.clone()], multisig_pub_key)?.into();
        let sigs = vec![
            GenericSignature::Signature(signer_sig),
            multisig_generic_sig,
        ];
        let transaction = Transaction::from_generic_sig_data(tx_data, intent, sigs);

        self.0
            .quorum_driver_api()
            .execute_transaction_block(
                transaction,
                SuiTransactionBlockResponseOptions::new()
                    .with_effects()
                    .with_events()
                    .with_input()
                    .with_object_changes()
                    .with_balance_changes(),
                Some(ExecuteTransactionRequestType::WaitForLocalExecution),
            )
            .await
            .map_err(|e| anyhow!(e))
    }

    /// Note that game should be finished
    pub fn delete_game(
        &self,
        signer: &SuiKeyPair,
        multisig_pub_key: &MultiSigPublicKey,
        gas_ref: ObjectRef,
        game_id: ObjectID,
    ) -> Result<SuiTransactionBlockResponse> {
        println!(
            "delete_game(signer: {}, multisig_pub_key: {}, gas_ref: ({}, {}, {}), game_id: {})",
            signer.public().encode_base64(),
            multisig_pub_key.to_string(),
            gas_ref.0,
            gas_ref.1,
            gas_ref.2,
            game_id
        );
        dbg!(signer);
        dbg!(multisig_pub_key);
        dbg!(game_id);

        todo!();
    }

    // ============================ Query calls ============================

    pub async fn fetch_available_game(
        &self,
        multisig_pub_key: &MultiSigPublicKey,
        fetch_filter: Option<&FetchGameFilter>,
    ) -> Result<TicTacToe> {
        let filter = SuiObjectDataFilter::StructType(StructTag {
            address: PACKAGE_ID.into(),
            module: Identifier::from_str(MODULE_NAME)?,
            name: Identifier::from_str(TIC_TAC_TOE_STRUCT_NAME)?,
            type_params: vec![],
        });

        // TODO: replace with bcs.
        // From content is way more verbose as we need to get to fields and then iter the fields.
        let query =
            SuiObjectResponseQuery::new(Some(filter), Some(SuiObjectDataOptions::full_content()));

        // TODO: cursor
        let rpc_res = self
            .0
            .read_api()
            .get_owned_objects(SuiAddress::from(multisig_pub_key), Some(query), None, None)
            .await?;

        rpc_res
            .data
            .iter()
            .find_map(|obj_resp| {
                let fields = match obj_resp.data.as_ref() {
                    Some(SuiObjectData {
                        content:
                            Some(SuiParsedData::MoveObject(SuiParsedMoveObject {
                                fields: SuiMoveStruct::WithFields(fields),
                                ..
                            })),
                        ..
                    }) => fields,
                    _ => {
                        return None;
                    }
                };

                let Ok(game) = TicTacToe::try_from(fields) else {
                    return None;
                };

                if let Some(fetch_filter) = fetch_filter {
                    fetch_filter.filter(game)
                } else {
                    Some(game)
                }
            })
            .ok_or(anyhow!("No available games"))
    }

    pub async fn fetch_game(&self, game_id: ObjectID) -> Result<TicTacToe> {
        // Get the raw BCS serialised move object data
        let current_game = self
            .0
            .read_api()
            .get_object_with_options(game_id, SuiObjectDataOptions::new().with_bcs())
            .await?;
        current_game
            .object()?
            .bcs
            .as_ref()
            .ok_or(anyhow!("bcs field is unexpectedly empty"))?
            .try_as_move()
            .ok_or(anyhow!("Cannot parse move object to game object"))?
            .deserialize()
    }

    pub async fn find_mark(&self, game_id: ObjectID, owner_addr: SuiAddress) -> Result<Mark> {
        let query = SuiObjectResponseQuery {
            filter: Some(SuiObjectDataFilter::StructType(StructTag {
                address: PACKAGE_ID.into(),
                module: Identifier::from_str(MODULE_NAME)?,
                name: Identifier::from_str(MARK_STRUCT_NAME)?,
                type_params: vec![],
            })),
            options: Some(SuiObjectDataOptions::new().with_bcs()),
        };
        // TODO cursor
        let mark = self
            .0
            .read_api()
            .get_owned_objects(owner_addr, Some(query), None, None)
            .await?;

        mark.data
            .iter()
            .find_map(|obj_resp| {
                let Some(obj_data) = obj_resp.object().ok() else {
                    println!("No reference to the object");
                    return None;
                };
                let Some(sui_raw_data) = obj_data.bcs.as_ref() else {
                    println!("No bcs data");
                    return None;
                };
                let Some(sui_raw_move_obj) = sui_raw_data.try_as_move() else {
                    println!("Object is package");
                    return None;
                };
                let Ok(mark): Result<Mark> = sui_raw_move_obj.deserialize() else {
                    println!("Cannot deserialize");
                    return None;
                };
                if mark.game_id.bytes == game_id {
                    Some(mark)
                } else {
                    None
                }
            })
            .ok_or(anyhow!("No mark found"))
    }

    pub async fn mark_owner(&self, mark_id: ObjectID) -> Result<SuiAddress> {
        let mark = self
            .0
            .read_api()
            .get_object_with_options(mark_id, SuiObjectDataOptions::new().with_owner())
            .await?;
        match mark
            .data
            .ok_or(anyhow!("No mark found"))?
            .owner
            .ok_or(anyhow!("No owner found"))?
        {
            Owner::AddressOwner(owner_addr) => Ok(owner_addr),
            _ => Err(anyhow!("Owner is not an address!")),
        }
    }
}

pub enum FetchGameFilter {
    FinishedFilter(bool),
}

impl FetchGameFilter {
    pub fn filter(&self, game: TicTacToe) -> Option<TicTacToe> {
        match self {
            Self::FinishedFilter(finished) => {
                if (game.finished == 0) == *finished {
                    Some(game)
                } else {
                    None
                }
            }
        }
    }
}
