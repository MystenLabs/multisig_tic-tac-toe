#[test_only]
module multisig_tic_tac_toe::test_multisig_tic_tac_toe {
    use sui::test_scenario;
    use multisig_tic_tac_toe::multisig_tic_tac_toe::{Self, Mark, TicTacToe, TicTacToeTrophy};

    // Tests that at game creation TicTacToe object is created for sender (multisig_addr) and mark
    // is passed to x_addr.
    #[test]
    fun test_create_game() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(multisig_addr);
        {
            let game = scenario.take_from_sender<TicTacToe>();
            scenario.return_to_sender(game);
            let mark = scenario.take_from_address<Mark>(x_addr);
            test_scenario::return_to_address(x_addr, mark);
        };

        scenario_val.end();
    }

    // Tests that mark is send successfully to TicTacToe owner
    #[test]
    fun test_send_mark() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        // Create AdminCap
        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(x_addr);
        {
            let mark = scenario.take_from_address<Mark>(x_addr);
            mark.send_mark_to_game(0, 0);
        };

        scenario.next_tx(multisig_addr);
        {
            let mark = scenario.take_from_sender<Mark>();
            scenario.return_to_sender(mark);
        };

        scenario_val.end();
    }

    // Tests that a player cannot give invalid row/col
    #[test]
    #[expected_failure(abort_code = ::multisig_tic_tac_toe::multisig_tic_tac_toe::EInvalidSize)]
    fun test_invalid_col_placement() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(x_addr);
        {
            let mark = scenario.take_from_sender<Mark>();
            mark.send_mark_to_game(0, 4);
        };
        scenario_val.end();
    }

    #[test]
    #[expected_failure(abort_code = ::multisig_tic_tac_toe::multisig_tic_tac_toe::EInvalidSize)]
    fun test_invalid_row_placement() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(x_addr);
        {
            let mark = scenario.take_from_sender<Mark>();
            mark.send_mark_to_game(255, 0);
        };
        scenario_val.end();
    }

    // Tests that mark cannot be re-sent to game after send
    #[test]
    #[expected_failure(abort_code = ::multisig_tic_tac_toe::multisig_tic_tac_toe::ETriedToCheat)]
    fun test_cheat() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(x_addr);
        {
            let mark = scenario.take_from_sender<Mark>();
            mark.send_mark_to_game(0, 1);
        };

        scenario.next_tx(multisig_addr);
        {
            let mark = scenario.take_from_sender<Mark>();
            mark.send_mark_to_game(1, 1);
        };

        scenario_val.end();
    }

    // Test place mark
    #[test]
    fun test_place_mark() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(x_addr);
        {
            let mark = scenario.take_from_sender<Mark>();
            mark.send_mark_to_game(0, 1);
        };

        scenario.next_tx(multisig_addr);
        {
            let mut game = scenario.take_from_sender<TicTacToe>();
            let mark = scenario.take_from_sender<Mark>();
            game.place_mark(mark, scenario.ctx());
            scenario.return_to_sender(game);
        };

        scenario.next_tx(multisig_addr);
        {
            let mark = scenario.take_from_address<Mark>(o_addr);
            test_scenario::return_to_address(o_addr, mark);
        };

        scenario_val.end();
    }

    // Tests that a player cannot place invalid mark
    #[test]
    #[expected_failure(abort_code = ::multisig_tic_tac_toe::multisig_tic_tac_toe::EMarkIsFromDifferentGame)]
    fun test_invalid_mark() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(x_addr);
        {
            let mark = scenario.take_from_sender<Mark>();
            mark.send_mark_to_game(0, 1);
        };

        scenario.next_tx(multisig_addr);
        {
            let mut game = scenario.take_from_sender<TicTacToe>();
            let mark = multisig_tic_tac_toe::create_fake_mark(option::some(2), multisig_addr);
            game.place_mark(mark, scenario.ctx());
            test_scenario::return_to_address(multisig_addr, game);
        };

        scenario_val.end();
    }

    #[test]
    fun test_cell_already_set() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;
        let row = 0;
        let col = 1;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(x_addr);
        {
            let mark = scenario.take_from_sender<Mark>();
            mark.send_mark_to_game(row, col);
        };

        scenario.next_tx(multisig_addr);
        {
            let mut game = scenario.take_from_sender<TicTacToe>();
            let mark = scenario.take_from_sender<Mark>();
            game.place_mark(mark, scenario.ctx());
            scenario.return_to_sender(game);
        };

        scenario.next_tx(multisig_addr);
        {
            let mark = scenario.take_from_address<Mark>(o_addr);
            mark.send_mark_to_game(row, col);
        };

        scenario.next_tx(multisig_addr);
        {
            let mut game = scenario.take_from_sender<TicTacToe>();
            let mark = scenario.take_from_sender<Mark>();
            game.place_mark(mark, scenario.ctx());
            scenario.return_to_sender(game);
        };

        scenario.next_tx(multisig_addr);
        {
            let mark = scenario.take_from_address<Mark>(o_addr);
            test_scenario::return_to_address(o_addr, mark);
        };

        scenario_val.end();
    }

    #[test]
    fun test_diag_x_win() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        //  0 | 3 | 6     X | O | O
        // -----------    ----------
        //  1 | 4 | 7  ->   | X |
        // -----------    ----------
        //  2 | 5 | 8       |   | X
        scenario.next_tx(multisig_addr);
        {
            let mut game = scenario.take_from_sender<TicTacToe>();
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(0, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(3, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(4, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(6, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(8, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());

            scenario.return_to_sender(game);
        };

        scenario.next_tx(multisig_addr);
        {
            let trophy = scenario.take_from_address<TicTacToeTrophy>(x_addr);
            test_scenario::return_to_address(x_addr, trophy);

            let game = scenario.take_from_sender<TicTacToe>();
            game.delete_game();
        };

        scenario_val.end();
    }

    #[test]
    fun test_diag_o_win() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        //  0 | 3 | 6     X | X | O
        // -----------    ----------
        //  1 | 4 | 7  ->   | O |
        // -----------    ----------
        //  2 | 5 | 8     O |   | X
        scenario.next_tx(multisig_addr);
        {
            let mut game = scenario.take_from_sender<TicTacToe>();
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(0, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(2, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(3, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(6, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(8, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(4, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());

            scenario.return_to_sender(game);
        };

        scenario.next_tx(multisig_addr);
        {
            let trophy = scenario.take_from_address<TicTacToeTrophy>(o_addr);
            test_scenario::return_to_address(o_addr, trophy);

            let game = scenario.take_from_sender<TicTacToe>();
            game.delete_game();
        };

        scenario_val.end();
    }


    #[test]
    fun test_draw() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        //  0 | 3 | 6     X | O | O
        // -----------    ----------
        //  1 | 4 | 7  -> O | X | X
        // -----------    ----------
        //  2 | 5 | 8     X | X | O
        scenario.next_tx(multisig_addr);
        {
            let mut game = scenario.take_from_sender<TicTacToe>();
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(0, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(1, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(2, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(3, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(4, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(6, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(5, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(8, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(7, multisig_addr, &game);
            game.place_mark(mark, scenario.ctx());

            scenario.return_to_sender(game);
        };

        let effects = scenario.next_tx(multisig_addr);
        assert!(test_scenario::created(&effects).length() == 0, 0);
        {
            let game = scenario.take_from_sender<TicTacToe>();
            game.delete_game();
        };

        scenario_val.end();
    }

    #[test]
    #[expected_failure(abort_code = ::multisig_tic_tac_toe::multisig_tic_tac_toe::ETriedToCheat)]
    fun test_illegal_delete() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let mut scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        scenario.next_tx(multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, scenario.ctx());
        };

        scenario.next_tx(multisig_addr);
        {
            let game = scenario.take_from_sender<TicTacToe>();
            game.delete_game();
        };

        scenario_val.end();
    }
}
