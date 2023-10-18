use std::fmt::Display;
use std::str::FromStr;

use anyhow::{Result, anyhow};
use clap::Parser;

use sui_types::crypto::{PublicKey, SuiKeyPair};
use sui_types::multisig::MultiSigPublicKey;


#[derive(Debug)]
pub struct Config {
    pub signer: SuiKeyPair,
    pub multisig_pub_key: MultiSigPublicKey,
}

impl TryFrom<TicTacToeOpts> for Config {
    type Error = anyhow::Error;

    fn try_from(opts: TicTacToeOpts) -> Result<Self> {
        let TicTacToeOpts {
            private_key,
            opponent_public_key,
            playing_as,
        } = opts;

        let signer = SuiKeyPair::from_str(&private_key).map_err(|e| anyhow!(e))?;
        let opponent_public_key =
            PublicKey::from_str(&opponent_public_key).map_err(|e| anyhow!(e))?;
        let pub_keys = match playing_as {
            Player::X => vec![signer.public(), opponent_public_key],
            Player::O => vec![opponent_public_key, signer.public()],
        };

        let multisig_pub_key = MultiSigPublicKey::new(pub_keys, vec![1, 1], 1)?;

        Ok(Config {
            signer,
            multisig_pub_key,
        })
    }
}

impl Config {
    pub fn current_player(&self) -> Player {
        if self.signer.public() == self.multisig_pub_key.pubkeys()[0].0 {
            Player::X
        } else {
            Player::O
        }
    }
}

#[derive(Debug, Parser)]
#[clap(
    name = "tic-tac-toe",
    about = "Multisig tic-tac-toe",
    rename_all = "kebab-case"
)]
pub struct TicTacToeOpts {
    /// Your private key in base64
    #[arg(short, long, required = true)]
    private_key: String,
    /// Opponent's public key in base64
    #[arg(short, long, required = true)]
    opponent_public_key: String,
    /// X | O
    #[arg(required = true)]
    playing_as: Player,
}

#[derive(Debug, Clone, Copy)]
pub enum Player {
    X,
    O,
}

impl FromStr for Player {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "x" | "X" => Ok(Player::X),
            "o" | "O" => Ok(Player::O),
            _ => Err(anyhow::anyhow!("Invalid player")),
        }
    }
}

impl Display for Player {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Player::X => "X",
            Player::O => "O",
        };
        write!(f, "{}", s)
    }
}
