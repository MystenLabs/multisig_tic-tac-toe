use std::collections::BTreeMap;

use anyhow::{Result, anyhow, bail};
use serde::{Serialize, Deserialize};

use sui_sdk::rpc_types::SuiMoveValue;
use sui_types::base_types::{ObjectID, SuiAddress};
use sui_types::id::{UID, ID};

type SuiMoveStructFields = BTreeMap<String, SuiMoveValue>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicTacToeTrophy {
    pub id: ObjectID,
    pub winner: SuiAddress,
    pub loser: SuiAddress,
    pub played_as: u8,
    pub game_id: ObjectID,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicTacToe {
    pub id: UID,
    /// Column major 3x3 game board
    pub gameboard: Vec<u8>,
    /// Index of current turn
    pub cur_turn: u8,
    pub x_addr: SuiAddress,
    pub o_addr: SuiAddress,
    pub finished: u8, // 0 not finished, 1 X Winner, 2 O Winner, 3 Draw
}

impl TryFrom<&SuiMoveStructFields> for TicTacToe {
    type Error = anyhow::Error;

    fn try_from(fields: &SuiMoveStructFields) -> Result<Self> {

        let SuiMoveValue::UID { id } = *fields
            .get("id")
            .ok_or(anyhow!("Missing field id"))? else {
                bail!("Field id is not UID");
            };
        let SuiMoveValue::Number(cur_turn) = fields
            .get("cur_turn")
            .ok_or(anyhow!("Missing field cur_turn"))? else {
                bail!("Field cur_turn is not Number");
            };
        let cur_turn = *cur_turn as u8;
        let SuiMoveValue::Number(finished) = fields
            .get("finished")
            .ok_or(anyhow!("Missing field finished"))? else {
                bail!("Field finished is not Number");
            };
        let finished = *finished as u8;
        let SuiMoveValue::Vector(gameboard) = fields
            .get("gameboard")
            .ok_or(anyhow!("Missing field gameboard"))? else {
                bail!("Field gameboard is not Vector");
            };
        let gameboard = gameboard
            .iter()
            .map(|v| {
                let SuiMoveValue::Number(n) = v else { panic!("Field gameboard is not Vector of Numbers") };
                *n as u8
            })
            .collect::<Vec<u8>>();
        let SuiMoveValue::Address(x_addr) = *fields
            .get("x_addr")
            .ok_or(anyhow!("Missing field x_addr"))? else {
                bail!("Field x_addr is not Address");
            };
        let SuiMoveValue::Address(o_addr) = *fields
            .get("o_addr")
            .ok_or(anyhow!("Missing field o_addr"))? else {
                bail!("Field o_addr is not Address");
            };

        Ok(Self {
            id: UID { id: ID { bytes: id } },
            cur_turn,
            finished,
            gameboard,
            x_addr,
            o_addr,
        })
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mark {
    pub id: UID,
    /// Column major 3x3 placement
    pub placement: Option<u8>,
    /// Flag that sets when the Mark is owned by a player
    pub during_turn: bool,
    /// Multi-sig account to place the mark
    pub game_owners: SuiAddress,
    /// TicTacToe object this mark is part of
    pub game_id: ID,
}

