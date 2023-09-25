use std::collections::BTreeMap;

use anyhow::{Result, anyhow, bail};

use sui_sdk::rpc_types::SuiMoveValue;
use sui_types::base_types::SuiAddress;


// TOPO refactor: use bcs to deserialize instead of unpacking SuiMoveValue
// Data structure mirroring move object `multisig_tic_tac_toe::TicTacToe` for deserialization.
#[derive(Debug)]
pub struct Tictactoe {
    cur_turn: u8,
    finished: bool,
    gameboard: Vec<u8>,
    x_addr: SuiAddress,
    o_addr: SuiAddress,
}

impl Tictactoe {
    pub fn from_fields(fields: &BTreeMap<String, SuiMoveValue>) -> Result<Self> {
        let SuiMoveValue::Number(cur_turn) = fields
            .get("cur_turn")
            .ok_or(anyhow!("Missing field cur_turn"))? else {
                bail!("Field cur_turn is not Number");
            };
        let cur_turn = *cur_turn as u8;
        let SuiMoveValue::Bool(finished) = *fields
            .get("finished")
            .ok_or(anyhow!("Missing field finished"))? else {
                bail!("Field finished is not Bool");
            };
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
            cur_turn,
            finished,
            gameboard,
            x_addr,
            o_addr,
        })
    }

    pub fn x_addr(&self) -> SuiAddress {
        self.x_addr
    }

    pub fn o_addr(&self) -> SuiAddress {
        self.o_addr
    }

    pub fn finished(&self) -> bool {
        self.finished
    }

    pub fn cur_turn(&self) -> u8 {
        self.cur_turn
    }

    pub fn gameboard(&self) -> &[u8] {
        &self.gameboard
    }

    pub fn is_my_turn(&self, my_identity: SuiAddress) -> bool {
        let current_player = if self.cur_turn % 2 == 0 {
            self.x_addr
        } else {
            self.o_addr
        };
        current_player == my_identity
    }
}
