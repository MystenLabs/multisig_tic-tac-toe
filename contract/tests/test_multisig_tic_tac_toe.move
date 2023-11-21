#[test_only]
module multisig_tic_tac_toe::test_multisig_tic_tac_toe {
    use sui::test_scenario;
    use std::option;
    use multisig_tic_tac_toe::multisig_tic_tac_toe::{Self, TicTacToe, Mark};

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
    fun test_invalid_placement() {
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

}
