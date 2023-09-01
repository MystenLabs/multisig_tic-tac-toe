# ⚠️ WORK IN PROGRESS ⚠️

# Multisig Tic Tac Toe

See also https://github.com/MystenLabs/sui/blob/main/crates/sui-sdk/examples/tic_tac_toe.rs and
https://github.com/MystenLabs/sui/blob/main/sui_programmability/examples/games/sources/shared_tic_tac_toe.move

Instead of sharing the game-board, it belongs to the multi-sig account of the two players

### Directories structure

- contract:
    - Contains the Move code of the smart contract

- tic-tac-toe_client:
    - Rust client 

- setup: Taken from https://github.com/MystenLabs/poc-template
    - A Typescript project, with ready-to-use:
        - environment variable (.env) file reading
        - Sui SDK integration
        - publish shell script
