use std::{
    fmt::Display,
    io::{stdin, stdout, Write},
    str::FromStr, thread, time::Duration,
};

use anyhow::Result;
use async_recursion::async_recursion;
use clap::Parser;
use tic_tac_toe_client::transactions::{RowCol, SuiConfig};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Player {
    X,
    O,
}

impl Player {
    pub fn playing_as_o(&self) -> bool {
        match self {
            Player::X => false,
            Player::O => true,
        }
    }
}

impl FromStr for Player {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "X" => Ok(Player::X),
            "O" => Ok(Player::O),
            "x" => Ok(Player::X),
            "o" => Ok(Player::O),
            _ => Err(format!("Invalid player: {}", s)),
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

#[derive(Debug, Parser)]
#[clap(
    name = "tic-tac-toe",
    about = "Multisig tic-tac-toe",
    rename_all = "kebab-case"
)]
struct TicTacToeOpts {
    #[arg(short, long, required = true, value_name = "player")]
    /// Choose to play as X or O
    player: Player,
}

#[tokio::main]
async fn main() -> Result<()> {
    let TicTacToeOpts { player } = TicTacToeOpts::parse();

    let config = SuiConfig::new_from_env(player.playing_as_o()).await?;

    if player == Player::X {
        let _resp = config.create_game().await?;

        // TODO refactor: get mark from response instead of my_marks
        let mark = config
            .my_marks()
            .await?
            .into_iter()
            .next()
            .expect("Could not find my mark");

        let game = config.game(mark.game_id()).await?;

        println!("Created new game, game id: {}", mark.game_id());
        println!("Player X: {}", game.x_addr());
        println!("Player O: {}", game.o_addr());
    }

    println!("Playing as {}", player);
    next_turn(config, player).await
}

#[async_recursion]
async fn next_turn(config: SuiConfig, player: Player) -> Result<()> {
    // TODO refactor: X already has the newest state of marks and game
    if let Some(mark) = config.my_marks().await?.into_iter().next() {
        let game = config.game(mark.game_id()).await?;

        print_gameboard(game.gameboard());

        if game.cur_turn() % 2 == (player.playing_as_o() as u8) {
            println!("It's your turn! (Playing as {})", player);
            let row = get_row_col_input(true);
            let col = get_row_col_input(false);

            let mut response = config.send_mark_to_game(mark.id(), row, col).await?;
            assert!(response.confirmed_local_execution.unwrap());

            response = config.place_mark(mark.game_id(), mark.id()).await?;
            assert!(response.confirmed_local_execution.unwrap());
        }
    // } else if { // TODO finish conditions
    } else {
        println!("Waiting for opponnent...");
        thread::sleep(Duration::from_secs(5));
    }

    next_turn(config, player).await
}

// Helper function for getting console input
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

fn print_gameboard(gameboard: &[u8]) {
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
                    panic!("Unexpected cell value");
                }
            };
            print!("|  {}  ", mark)
        }
        println!("|");
        print!("  ├-----┼-----┼-----┤");
    }
    print!("\r");
    println!("  └-----┴-----┴-----┘");
}
