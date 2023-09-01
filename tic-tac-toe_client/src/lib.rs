pub mod transactions;

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::transactions::{SuiConfig, RowCol};
    use anyhow::Result;
    use sui_sdk::rpc_types::{ObjectChange, SuiTransactionBlockResponse};

    #[tokio::test]
    async fn test_select_gas() -> Result<()> {
        let sui_config = SuiConfig::new_from_env().await?;

        let gas = sui_config
            .select_gas(sui_config.my_address, None, 10_000_000, vec![])
            .await?;
        println!("gas = {:?}", gas);
        Ok(())
    }

    #[tokio::test]
    async fn test_create_game() -> Result<()> {
        let sui_config = SuiConfig::new_from_env().await?;

        let resp: SuiTransactionBlockResponse = sui_config.create_game().await?;
        assert!(resp.confirmed_local_execution.is_some());

        // println!("resp = {:#?}", resp);

        let Some(obj_changes) = resp.object_changes else {unreachable!()};

        let tic_tac_toe = obj_changes
            .iter()
            .filter(|obj_change| {
                if let ObjectChange::Created { object_type, .. } = obj_change {
                    object_type.name.to_string() == "TicTacToe"
                } else {
                    false
                }
            })
            .next();

        let mark = obj_changes
            .iter()
            .filter(|obj_change| {
                if let ObjectChange::Created { object_type, .. } = obj_change {
                    object_type.name.to_string() == "Mark"
                } else {
                    false
                }
            })
            .next();

        println!("Obj change TicTacToe = {:#?}", tic_tac_toe);
        println!("Obj change Mark = {:#?}", mark);

        tokio::time::sleep(Duration::from_secs(4)).await;

        sui_config.get_game().await.unwrap();

        Ok(())
    }

    #[tokio::test]
    async fn test_send_mark_to_game() -> Result<()> {

        let sui_config = SuiConfig::new_from_env().await?;

        let resp_create: SuiTransactionBlockResponse = sui_config.create_game().await?;
        assert!(resp_create.confirmed_local_execution.is_some());

        let Some(obj_changes) = resp_create.object_changes else {unreachable!()};

        let _tic_tac_toe = obj_changes
            .iter()
            .filter(|obj_change| {
                if let ObjectChange::Created { object_type, .. } = obj_change {
                    object_type.name.to_string() == "TicTacToe"
                } else {
                    false
                }
            })
            .next()
            .expect("TicTacToe not found");

        let mark = obj_changes
            .iter()
            .filter(|obj_change| {
                if let ObjectChange::Created { object_type, .. } = obj_change {
                    object_type.name.to_string() == "Mark"
                } else {
                    false
                }
            })
            .next()
            .expect("Mark not found");

        // tokio::time::sleep(Duration::from_secs(1)).await;
        let resp_send = sui_config.send_mark_to_game(mark.object_id(), RowCol::First, RowCol::Second).await?;
        assert!(resp_send.confirmed_local_execution.is_some());

        // println!("resp_send = {:#?}", resp_send);

        Ok(())
    }

    #[tokio::test]
    async fn test_place_mark() -> Result<()> {

        let sui_config = SuiConfig::new_from_env().await?;

        let resp_create: SuiTransactionBlockResponse = sui_config.create_game().await?;
        assert!(resp_create.confirmed_local_execution.is_some());

        let Some(obj_changes) = resp_create.object_changes else {unreachable!()};

        let tic_tac_toe = obj_changes
            .iter()
            .filter(|obj_change| {
                if let ObjectChange::Created { object_type, .. } = obj_change {
                    object_type.name.to_string() == "TicTacToe"
                } else {
                    false
                }
            })
            .next()
            .expect("TicTacToe not found");

        let mark = obj_changes
            .iter()
            .filter(|obj_change| {
                if let ObjectChange::Created { object_type, .. } = obj_change {
                    object_type.name.to_string() == "Mark"
                } else {
                    false
                }
            })
            .next()
            .expect("Mark not found");

        let resp_send = sui_config.send_mark_to_game(mark.object_id(), RowCol::First, RowCol::Second).await?;
        assert!(resp_send.confirmed_local_execution.is_some());

        // println!("resp_send = {:#?}", resp_send);

        let resp_place = sui_config.place_mark(tic_tac_toe.object_id(), mark.object_id()).await?;
        assert!(resp_place.confirmed_local_execution.is_some());

        println!("resp_place = {:#?}", resp_place);

        Ok(())
    }

    #[tokio::test]
    async fn row_col_to_json_value() -> Result<()> {
        let row_col = RowCol::First;
        let json_value = serde_json::to_value(row_col)?;
        println!("json_value = {:#?}", json_value);
        Ok(())
    }
}
