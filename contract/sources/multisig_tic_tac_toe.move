/// Contract for playing Tic Tac Toe using the MultiSig 1-out-of-2 account as game admin.
/// In this case, as the players are only 2, the design could be simpler by passing the TicTacToe
/// object directly, instead of passing a Mark object.
/// However this is an attempt to illustrate the possibility that (1 out of N) multisig addresses
/// can be used as replacement of shared objects in some cases.
/// One could also use:
/// 1. Events for triggering client updates.
/// 2. Clock for preventing player hanging the game.
module multisig_tic_tac_toe::multisig_tic_tac_toe {
    use std::vector;
    use std::option::{Self, Option};

    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const MARK_EMPTY: u8 = 0;
    const MARK_X: u8 = 1;
    const MARK_O: u8 = 2;

    const EInvalidSize: u64 = 0;
    const ETriedToCheat: u64 = 1;
    const EMarkIsFromDifferentGame: u64 = 2;

    struct TicTacToeTrophy has key {
        id: UID,
        winner: address,
        loser: address,
        played_as: u8,
        game_id: ID
    }

    struct TicTacToe has key {
        id: UID,
        /// Column major 3x3 game board
        gameboard: vector<u8>,
        /// Index of current turn
        cur_turn: u8,
        x_addr: address,
        o_addr: address,
        /// 0 not finished, 1 X Winner, 2 O Winner, 3 Draw
        finished: u8
    }

    struct Mark has key {
        id: UID,
        /// Column major 3x3 placement
        placement: Option<u8>,
        /// Flag that sets when the Mark is owned by a player
        during_turn: bool,
        /// Multi-sig account to place the mark
        game_owners: address,
        /// TicTacToe object this mark is part of
        game_id: ID
    }

    /// This should be called by a multisig (1 out of 2) address.
    /// x_addr and o_addr should be the two addresses part-taking in the multisig.
    public entry fun create_game(x_addr: address, o_addr: address, ctx: &mut TxContext) {
        let id = object::new(ctx);
        let game_id = object::uid_to_inner(&id);

        let tic_tac_toe = TicTacToe {
            id,
            gameboard: vector[MARK_EMPTY, MARK_EMPTY, MARK_EMPTY,
                               MARK_EMPTY, MARK_EMPTY, MARK_EMPTY,
                               MARK_EMPTY, MARK_EMPTY, MARK_EMPTY],
            cur_turn: 0,
            x_addr,
            o_addr,
            finished: 0
        };
        let mark = Mark {
            id: object::new(ctx),
            placement: option::none(),
            during_turn: true, // Mark is passed to x_addr
            game_owners: tx_context::sender(ctx),
            game_id
        };

        transfer::transfer(tic_tac_toe, tx_context::sender(ctx));
        transfer::transfer(mark, x_addr);
    }

    /// This is called by the one of the two addresses participating in the multisig, but not from
    /// the multisig itself.
    /// row: [0 - 2], col: [0 - 2]
    public entry fun send_mark_to_game(mark: Mark, row: u8, col: u8) {
        // Mark.during_turn prevents multisig-acc from editing mark.placement after it has been sent to it.
        assert!(mark.during_turn, ETriedToCheat);

        option::fill(&mut mark.placement, get_index(row, col));
        mark.during_turn = false;
        let game_owners = mark.game_owners;
        transfer::transfer(mark, game_owners);
    }

    /// This is called by the multisig account to execute the last move by the player who used
    /// `send_mark_to_game`.
    /// REVIEW Can this work? (transfer obj to sender): Maybe we can pass TicTacToe "by value" in
    /// order to be able to burn it directly on game-finished, while returning it to the owner 
    /// (multisig-acc) otherwise
    public entry fun place_mark(game: &mut TicTacToe, mark: Mark, ctx: &mut TxContext) {
        assert!(mark.game_id == object::uid_to_inner(&game.id), EMarkIsFromDifferentGame);

        let addr = get_cur_turn_address(game);
        // Note here we empty the option
        let placement: u8 = option::extract(&mut mark.placement);
        if (get_cell_by_index(&game.gameboard, placement) != MARK_EMPTY) {
            mark.during_turn = true;
            transfer::transfer(mark, addr);
            return
        };

        // Apply turn
        let mark_symbol = if (addr == game.x_addr) {
            MARK_X
        } else {
            MARK_O
        };
        *vector::borrow_mut(&mut game.gameboard, (placement as u64)) = mark_symbol;

        // Check for winner
        let winner = get_winner(game);

        // Game ended!
        if (option::is_some(&winner)) {
            let played_as = option::extract(&mut winner);
            let (winner, loser, finished) = if (played_as == MARK_X) {
                (game.x_addr, game.o_addr, 1)
            } else {
                (game.o_addr, game.x_addr, 2)
            };

            transfer::transfer(
                TicTacToeTrophy {
                    id: object::new(ctx),
                    winner,
                    loser,
                    played_as,
                    game_id: object::uid_to_inner(&game.id)
                },
                winner
            );

            delete_mark(mark);
            * &mut game.finished = finished;
            return
        } else if (game.cur_turn >= 8) {    // Draw
            delete_mark(mark);
            * &mut game.finished = 3;
            return
        };

        // Next turn
        * &mut game.cur_turn = game.cur_turn + 1;
        addr = get_cur_turn_address(game);
        mark.during_turn = true;
        transfer::transfer(mark, addr);
    }

    /// Deletes TicTacToe. Game should be finished first.
    public entry fun delete_game(game: TicTacToe) {
        let TicTacToe {
            id,
            gameboard: _,
            cur_turn: _,
            x_addr: _,
            o_addr: _,
            finished
        } = game;
        assert!(finished != 0, ETriedToCheat);
        object::delete(id);
    }

    /// Internal: Only called when the game is finished
    fun delete_mark(mark: Mark) {
        let Mark {
            id,
            placement: _,
            during_turn: _,
            game_owners:_ ,
            game_id: _
        } = mark;
        object::delete(id);
    }

    fun get_cur_turn_address(game: &TicTacToe): address {
        if (game.cur_turn % 2 == 0) {
            game.x_addr
        } else {
            game.o_addr
        }
    }

    fun get_winner(game: &TicTacToe): Option<u8> {
        if (game.cur_turn < 4) {
            return option::none()
        };

        let p00 = get_cell(&game.gameboard, 0, 0);
        let p01 = get_cell(&game.gameboard, 0, 1);
        let p02 = get_cell(&game.gameboard, 0, 2);
        let p10 = get_cell(&game.gameboard, 1, 0);
        let p11 = get_cell(&game.gameboard, 1, 1);
        let p12 = get_cell(&game.gameboard, 1, 2);
        let p20 = get_cell(&game.gameboard, 2, 0);
        let p21 = get_cell(&game.gameboard, 2, 1);
        let p22 = get_cell(&game.gameboard, 2, 2);

        // Check all rows
        let win_mark = check_for_winner(p00, p01, p02);
        if (option::is_some(&win_mark)) {
            return win_mark
        };
        win_mark = check_for_winner(p10, p11, p12);
        if (option::is_some(&win_mark)) {
            return win_mark
        };
        win_mark = check_for_winner(p20, p21, p22);
        if (option::is_some(&win_mark)) {
            return win_mark
        };

        // Check all columns
        win_mark = check_for_winner(p00, p10, p20);
        if (option::is_some(&win_mark)) {
            return win_mark
        };
        win_mark = check_for_winner(p01, p11, p21);
        if (option::is_some(&win_mark)) {
            return win_mark
        };
        win_mark = check_for_winner(p02, p12, p22);
        if (option::is_some(&win_mark)) {
            return win_mark
        };

        // Check diagonals
        win_mark = check_for_winner(p00, p11, p22);
        if (option::is_some(&win_mark)) {
            return win_mark
        };
        win_mark = check_for_winner(p02, p11, p20);
        if (option::is_some(&win_mark)) {
            return win_mark
        };
        option::none()
    }

    /// Checks equality of 3 marks and returns it if they are not empty
    fun check_for_winner(mark_1: u8, mark_2: u8, mark_3: u8): Option<u8>  {
        if (mark_1 == mark_2 && mark_2 == mark_3 && mark_1 != MARK_EMPTY) {
            return option::some(mark_1)
        };
        option::none()
    }

    /// Gets column major cell from 3x3 matrix
    fun get_cell(mat33: &vector<u8>, row: u8, col: u8): u8 {
        assert!(vector::length(mat33) == 9, EInvalidSize);
        let index = get_index(row, col);

        *vector::borrow(mat33, (index as u64))
    }

    fun get_cell_by_index(mat33: &vector<u8>, index: u8): u8 {
        assert!(index < 9, EInvalidSize);
        *vector::borrow(mat33, (index as u64))
    }

    /// Gets column major index from 3x3 matrix
    fun get_index(row: u8, col: u8): u8 {
        assert!(row < 3 && col < 3, EInvalidSize);
        col*3 + row
    }
}
