use std::collections::BTreeMap;

use anyhow::{Result, anyhow, bail};

use sui_sdk::rpc_types::SuiMoveValue;
use sui_types::base_types::ObjectID;

// TODO refactor: use bcs to deserialize instead of unpacking SuiMoveValue
// Data structure mirroring move object `multisig_tic_tac_toe::Mark` for deserialization.
#[derive(Debug)]
pub struct Mark {
    id: ObjectID,
    game_id: ObjectID,
}

impl Mark {
    pub fn from_fields(fields: &BTreeMap<String, SuiMoveValue>) -> Result<Self> {
        let SuiMoveValue::UID{ id } = *fields
            .get("id")
            .ok_or(anyhow!("Missing field id"))? else {
                bail!("Wrong type for field id")
            };
        let SuiMoveValue::Address(game_id) = *fields
            .get("game_id")
            .ok_or(anyhow!("Missing field game_id"))? else {
                bail!("Wrong type for field game_id") 
            };
        Ok(Mark {
            id,
            game_id: game_id.into(),
        })
    }

    pub fn id(&self) -> ObjectID {
        self.id
    }

    pub fn game_id(&self) -> ObjectID {
        self.game_id
    }
}

