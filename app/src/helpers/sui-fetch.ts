import { MoveStructGame } from "../types/game-move";
import { PACKAGE_ADDRESS, SUI_FULLNODE_URL } from "../config";
import { SuiClient } from "@mysten/sui.js/client";
import { MoveStructMark } from "../types/mark-move";

export async function fetchGame(gameId: string) {
    // REVIEW hardcoded: Find network from wallet
    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });

    const gameResp = await suiClient.getObject({
        id: gameId!,
        options: { showContent: true }
    }).catch((err) => {
        console.log("SuiClient.getObject threw:");
        console.log(err);
    });
    if (!gameResp) {
        return;
    }

    const fetchedGame = gameResp.data;
    if (!fetchedGame) {
        console.log('Game not found');
        return;
    }
    const suiParsedData = fetchedGame.content as {
        dataType: 'moveObject';
        fields: MoveStructGame;
        hasPublicTransfer: boolean;
        type: string;
    };

    return suiParsedData.fields;
}

export async function findGame(multiSigAddr: string) {
    // REVIEW hardcoded: Find network from wallet
    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });
    const games = await suiClient.getOwnedObjects({
        owner: multiSigAddr,
        filter: {
            StructType: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::TicTacToe`,
        },
        options: { showContent: true },
    });

    /// Just in case someone send the gameboard to the wrong address
    const validGames = games.data.filter((objResp) => {
        const content = objResp.data?.content;
        if (content?.dataType != "moveObject") {
            return false;
        }
        const fields = content.fields as {
            o_addr: string;
            x_addr: string;
            finished: number;
        };
        return fields["finished"] === 0;
    });

    if (!validGames.length) {
        console.log("No games found");
        return;
    }
    return validGames[0].data;
}

export async function fetchMark(owner: string, gameId: string) {
    const suiClient = new SuiClient({ url: SUI_FULLNODE_URL });

    const marksResp = await suiClient.getOwnedObjects({
        owner,
        filter: {
            StructType: `${PACKAGE_ADDRESS}::multisig_tic_tac_toe::Mark`
        },
        options: {
            showContent: true
        }
    }).catch((err) => {
        console.log("SuiClient.getOwnedObjects threw:");
        console.log(err);
    });
    if (!marksResp) {
        return;
    }

    const fetchedMarks = marksResp.data.filter((mark) => {
        const suiParsedData = mark.data?.content as {
            dataType: 'moveObject';
            fields: MoveStructMark;
            hasPublicTransfer: boolean;
            type: string;
        };
        return suiParsedData.fields.game_id === gameId;
    });
    if (!fetchedMarks.length) {
        console.log('No marks found');
        return;
    }
    const content0 = fetchedMarks[0]?.data?.content as {
        dataType: 'moveObject';
        fields: MoveStructMark;
        hasPublicTransfer: boolean;
        type: string;
    };
    return content0.fields;
}
