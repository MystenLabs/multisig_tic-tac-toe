
mod mark;
pub use mark::Mark;
mod tictactoe;
pub use tictactoe::Tictactoe;

use std::str::FromStr;

use anyhow::{anyhow, Result};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub enum RowCol {
    #[serde(rename = "0")]
    First,
    #[serde(rename = "1")]
    Second,
    #[serde(rename = "2")]
    Third,
}

impl FromStr for RowCol {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "0" => Ok(RowCol::First),
            "1" => Ok(RowCol::Second),
            "2" => Ok(RowCol::Third),
            _ => Err(anyhow!("Invalid row/col: {}", s)),
        }
    }
}

