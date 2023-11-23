#[test_only]
module multisig_tic_tac_toe::test_multisig_tic_tac_toe {
    use std::option;
    use std::vector;
    use sui::test_scenario;
    use multisig_tic_tac_toe::multisig_tic_tac_toe::{Self, Mark, TicTacToe, TicTacToeTrophy};

    // Tests that at game creation TicTacToe object is created for sender (multisig_addr) and mark
    // is passed to x_addr.
    #[test]
    fun test_create_game() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            test_scenario::return_to_sender(scenario, game);
            let mark = test_scenario::take_from_address<Mark>(scenario, x_addr);
            test_scenario::return_to_address(x_addr, mark);
        };

        test_scenario::end(scenario_val);
    }

    // Tests that mark is send successfully to TicTacToe owner
    #[test]
    fun test_send_mark() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        // Create AdminCap
        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, x_addr);
        {
            let mark = test_scenario::take_from_address<Mark>(scenario, x_addr);
            multisig_tic_tac_toe::send_mark_to_game(mark, 0, 0);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            test_scenario::return_to_sender(scenario, mark);
        };

        test_scenario::end(scenario_val);
    }

    // Tests that a player cannot give invalid row/col
    #[test]
    #[expected_failure(abort_code = multisig_tic_tac_toe::multisig_tic_tac_toe::EInvalidSize)]
    fun test_invalid_col_placement() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, x_addr);
        {
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::send_mark_to_game(mark, 0, 4);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = multisig_tic_tac_toe::multisig_tic_tac_toe::EInvalidSize)]
    fun test_invalid_row_placement() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, x_addr);
        {
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::send_mark_to_game(mark, 255, 0);
        };
        test_scenario::end(scenario_val);
    }

    // Tests that mark cannot be re-sent to game after send
    #[test]
    #[expected_failure(abort_code = multisig_tic_tac_toe::multisig_tic_tac_toe::ETriedToCheat)]
    fun test_cheat() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, x_addr);
        {
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::send_mark_to_game(mark, 0, 1);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::send_mark_to_game(mark, 1, 1);
        };

        test_scenario::end(scenario_val);
    }

    // Test place mark
    #[test]
    fun test_place_mark() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, x_addr);
        {
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::send_mark_to_game(mark, 0, 1);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            test_scenario::return_to_sender(scenario, game);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let mark = test_scenario::take_from_address<Mark>(scenario, o_addr);
            test_scenario::return_to_address(o_addr, mark);
        };

        test_scenario::end(scenario_val);
    }

    // Tests that a player cannot place invalid mark
    #[test]
    #[expected_failure(abort_code = multisig_tic_tac_toe::multisig_tic_tac_toe::EMarkIsFromDifferentGame)]
    fun test_invalid_mark() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, x_addr);
        {
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::send_mark_to_game(mark, 0, 1);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            let mark = multisig_tic_tac_toe::create_fake_mark(option::some(2), multisig_addr);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            test_scenario::return_to_address(multisig_addr, game);
        };

        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_cell_already_set() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;
        let row = 0;
        let col = 1;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, x_addr);
        {
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::send_mark_to_game(mark, row, col);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            test_scenario::return_to_sender(scenario, game);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let mark = test_scenario::take_from_address<Mark>(scenario, o_addr);
            multisig_tic_tac_toe::send_mark_to_game(mark, row, col);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            let mark = test_scenario::take_from_sender<Mark>(scenario);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            test_scenario::return_to_sender(scenario, game);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let mark = test_scenario::take_from_address<Mark>(scenario, o_addr);
            test_scenario::return_to_address(o_addr, mark);
        };

        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_diag_x_win() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        //  0 | 3 | 6     X | O | O
        // -----------    ----------
        //  1 | 4 | 7  ->   | X |  
        // -----------    ----------
        //  2 | 5 | 8       |   | X
        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(0, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(3, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(4, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(6, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(8, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));

            test_scenario::return_to_sender(scenario, game);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let trophy = test_scenario::take_from_address<TicTacToeTrophy>(scenario, x_addr);
            test_scenario::return_to_address(x_addr, trophy);

            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            multisig_tic_tac_toe::delete_game(game);
        };

        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_diag_o_win() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        //  0 | 3 | 6     X | X | O
        // -----------    ----------
        //  1 | 4 | 7  ->   | O |  
        // -----------    ----------
        //  2 | 5 | 8     O |   | X
        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(0, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(2, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(3, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(6, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(8, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(4, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));

            test_scenario::return_to_sender(scenario, game);
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let trophy = test_scenario::take_from_address<TicTacToeTrophy>(scenario, o_addr);
            test_scenario::return_to_address(o_addr, trophy);

            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            multisig_tic_tac_toe::delete_game(game);
        };

        test_scenario::end(scenario_val);
    }


    #[test]
    fun test_draw() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        //  0 | 3 | 6     X | O | O
        // -----------    ----------
        //  1 | 4 | 7  -> O | X | X
        // -----------    ----------
        //  2 | 5 | 8     X | X | O
        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(0, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(1, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(2, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(3, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(4, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(6, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(5, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // o-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(8, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));
            // x-turn
            let mark = multisig_tic_tac_toe::create_legit_mark(7, multisig_addr, &game);
            multisig_tic_tac_toe::place_mark(&mut game, mark, test_scenario::ctx(scenario));

            test_scenario::return_to_sender(scenario, game);
        };

        let effects = test_scenario::next_tx(scenario, multisig_addr);
        assert!(vector::length(&test_scenario::created(&effects)) == 0, 0);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            multisig_tic_tac_toe::delete_game(game);
        };

        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = multisig_tic_tac_toe::multisig_tic_tac_toe::ETriedToCheat)]
    fun test_illegal_delete() {
        let x_addr = @0x2000;
        let o_addr = @0x0010;
        let multisig_addr = @0x2010;

        let scenario_val = test_scenario::begin(multisig_addr);
        let scenario = &mut scenario_val;

        test_scenario::next_tx(scenario, multisig_addr);
        {
            multisig_tic_tac_toe::create_game(x_addr, o_addr, test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, multisig_addr);
        {
            let game = test_scenario::take_from_sender<TicTacToe>(scenario);
            multisig_tic_tac_toe::delete_game(game);
        };

        test_scenario::end(scenario_val);
    }
}
