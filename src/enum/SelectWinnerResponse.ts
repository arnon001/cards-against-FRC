import { Player } from "../Player";

export interface SelectWinnerResponse {
	success: boolean;
	player?: Player;
}