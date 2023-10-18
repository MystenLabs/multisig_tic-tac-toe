use std::fmt::Display;
use std::str::FromStr;

use anyhow::{Result, anyhow};

#[derive(Debug)]
pub enum RowCol {
    First,
    Second,
    Third
}

impl Into<u8> for RowCol {
    fn into(self) -> u8 {
        match self {
            RowCol::First => 0,
            RowCol::Second => 1,
            RowCol::Third => 2
        }
    }
}

impl<'a> Into<&'a u8> for &'a RowCol {
    fn into(self) -> &'a u8 {
        match self {
            RowCol::First => &0,
            RowCol::Second => &1,
            RowCol::Third => &2
        }
    }
}

impl TryFrom<u8> for RowCol {
    type Error = anyhow::Error;

    fn try_from(value: u8) -> Result<Self> {
        match value {
            0 => Ok(RowCol::First),
            1 => Ok(RowCol::Second),
            2 => Ok(RowCol::Third),
            _ => Err(anyhow!("Invalid RowCol value: {}", value))
        }
    }
}

impl FromStr for RowCol {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "0" => Ok(RowCol::First),
            "1" => Ok(RowCol::Second),
            "2" => Ok(RowCol::Third),
            "first" => Ok(RowCol::First),
            "second" => Ok(RowCol::Second),
            "third" => Ok(RowCol::Third),
            "First" => Ok(RowCol::First),
            "Second" => Ok(RowCol::Second),
            "Third" => Ok(RowCol::Third),
            "FIRST" => Ok(RowCol::First),
            "SECOND" => Ok(RowCol::Second),
            "THIRD" => Ok(RowCol::Third),
            _ => Err(anyhow!("Invalid RowCol value: {}", s))
        }
    }
}

impl Display for RowCol {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self)
    }
}

pub type Row = RowCol;
pub type Col = RowCol;
