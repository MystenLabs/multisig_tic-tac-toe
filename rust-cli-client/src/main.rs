use std::io::{stdin, stdout, Write};
use std::str::FromStr;
use std::thread;
use std::time::Duration;

use anyhow::{anyhow, Result};
use async_recursion::async_recursion;
use clap::Parser;

use sui_sdk::rpc_types::{SuiExecutionStatus, SuiTransactionBlockEffectsAPI};
use sui_types::base_types::{ObjectID, SuiAddress};
use sui_types::object::Owner;
use sui_types::storage::WriteKind;

use rust_cli_client::contract_structs::Mark;
use rust_cli_client::row_col::RowCol;
use rust_cli_client::startup::{Config, Player, TicTacToeOpts};
use rust_cli_client::tic_tac_toe_client::{FetchGameFilter, TicTacToeClient};

#[tokio::main]
async fn main() -> Result<()> {
    let config = Config::try_from(TicTacToeOpts::parse())?;
    let client = TicTacToeClient::new(Some("https://rpc.testnet.sui.io:443")).await?;

    // First try to fetch game
    let game_info = match client
        .fetch_available_game(
            &config.multisig_pub_key,
            Some(&FetchGameFilter::FinishedFilter(true)),
        )
        .await
    {
        Ok(game) => {
            let possible_owner = match game.cur_turn%2 {
                0 => SuiAddress::from(&config.multisig_pub_key.pubkeys()[0].0),
                1 => SuiAddress::from(&config.multisig_pub_key.pubkeys()[1].0),
                _ => panic!("Solar electromagnetic radiation"),
            };
            let mark: Mark = match client
                .find_mark(
                    game.id.id.bytes,
                    possible_owner
                )
                .await
            {
                Ok(mark) => mark,
                Err(e) => match e.to_string().as_str() {
                    "No mark found" => {
                        client
                            .find_mark(game.id.id.bytes, SuiAddress::from(&config.multisig_pub_key))
                            .await?
                    }
                    _ => return Err(e),
                },
            };
            GameInfo {
                game_id: game.id.id.bytes,
                mark_id: mark.id.id.bytes,
            }
        }
        Err(e) => match e.to_string().as_str() {
            "No available games" => {
                // If game doesn't exist, create it
                let create_game_resp = client
                    .create_game(&config.signer, config.multisig_pub_key.clone(), None)
                    .await?;
                if create_game_resp.errors.len() != 0 {
                    return Err(anyhow!(
                        "Error creating game: {:?}",
                        create_game_resp.errors
                    ));
                }
                let status = create_game_resp
                    .effects
                    .as_ref()
                    .ok_or(anyhow!("No effects"))?
                    .status();
                if let SuiExecutionStatus::Failure { error } = status {
                    return Err(anyhow!("Error creating game: {:?}", error));
                }

                let Some(effects) = create_game_resp.effects else {
                    return Err(anyhow!("No effects"));
                };
                // TODO: find out if the object type is also available at the response
                dbg!(&effects);

                // Get the game.id as the only object created under the multisig-account from the response
                let game_id = effects
                    .all_changed_objects()
                    .iter()
                    .filter(|(obj_ref, write_kind)| match write_kind {
                        WriteKind::Create => {
                            let Owner::AddressOwner(owner_addr) = obj_ref.owner else {
                                return false;
                            };
                            owner_addr == SuiAddress::from(&config.multisig_pub_key)
                        }
                        _ => false,
                    })
                    .next()
                    .ok_or(anyhow!("No object created under multisig account"))?
                    .0
                    .object_id();
                let mark_id = effects
                    .all_changed_objects()
                    .iter()
                    .filter(|(obj_ref, write_kind)| match write_kind {
                        WriteKind::Create => {
                            let Owner::AddressOwner(owner_addr) = obj_ref.owner else {
                                return false;
                            };
                            owner_addr == SuiAddress::from(&config.multisig_pub_key.pubkeys()[0].0)
                        }
                        _ => false,
                    })
                    .next()
                    .ok_or(anyhow!("No object created under first participant account"))?
                    .0
                    .object_id();
                GameInfo { game_id, mark_id }
            }
            _ => return Err(e),
        },
    };

    play_game(client, config, game_info).await?;

    Ok(())
}

#[derive(Debug, Clone)]
struct GameInfo {
    game_id: ObjectID,
    mark_id: ObjectID,
}

#[async_recursion]
async fn play_game(client: TicTacToeClient, config: Config, game_info: GameInfo) -> Result<()> {
    let game = client.fetch_game(game_info.game_id).await?;
    let mark_id = game_info.mark_id;

    println!("You are playing as {}", config.current_player());

    match game.finished {
        0 => {
            // Not finished
            match (game.cur_turn % 2, config.current_player()) {
                // Which turn?
                (0, Player::X) | (1, Player::O) => {
                    // My turn
                    print_gameboard(&game.gameboard)?;
                    let row = get_row_col_input(true);
                    let col = get_row_col_input(false);

                    let mark_owner = client.mark_owner(mark_id).await?;
                    // Sometimes during the place call a coin can be equivocated, so we may need to
                    // only call place
                    let skip_send = mark_owner == SuiAddress::from(&config.multisig_pub_key);
                    if !skip_send {
                        // cur-turn changes on mark-placement, so this shouldn't be possible
                        debug_assert!(
                            mark_owner == SuiAddress::from(&config.signer.public()),
                            "Inconsistency between cur_turn and mark-owner"
                        );
                        client
                            .send_mark_to_game(&config.signer, mark_id, row, col)
                            .await?;
                    }
                    client
                        .place_mark(
                            &config.signer,
                            config.multisig_pub_key.clone(),
                            None,
                            game.id.id.bytes,
                            mark_id,
                        )
                        .await?;
                    let new_gameboard = client.fetch_game(game_info.game_id).await?.gameboard;
                    print_gameboard(&new_gameboard)?;
                }
                _ => {
                    // Opponent's turn
                    println!("Waiting for opponnent...");
                }
            };
            thread::sleep(Duration::from_secs(2));
            play_game(client, config, game_info).await
        }
        1 => {
            println!("X won!");
            Ok(())
        }
        2 => {
            println!("O won!");
            Ok(())
        }
        3 => {
            println!("Draw");
            Ok(())
        }
        _ => Err(anyhow!("Invalid game state")),
    }
}

fn get_row_col_input(is_row: bool) -> RowCol {
    let r_c = if is_row { "row" } else { "column" };
    print!("Enter {} number (0-2) : ", r_c);
    let _ = stdout().flush();
    let mut s = String::new();
    stdin()
        .read_line(&mut s)
        .expect("Did not enter a correct string");

    if let Ok(row_col) = RowCol::from_str(s.trim()) {
        row_col
    } else {
        get_row_col_input(is_row)
    }
}

fn print_gameboard(gameboard: &[u8]) -> Result<()> {
    println!("     0     1     2");
    print!("  ┌-----┬-----┬-----┐");
    for row in 0..3 {
        println!();
        print!("{} ", row);
        for col in 0..3 {
            let mark = match gameboard[col * 3 + row] {
                0 => " ",
                1 => "X",
                2 => "O",
                _ => {
                    return Err(anyhow!("Unexpected cell value"));
                }
            };
            print!("|  {}  ", mark)
        }
        println!("|");
        print!("  ├-----┼-----┼-----┤");
    }
    print!("\r");
    println!("  └-----┴-----┴-----┘");
    Ok(())
}
