import { CustomSettingsLimits } from "./CustomSettingsLimits";

export interface Settings {
	port: number;

	maxPlayersPerGame: number;

	maxGameNameLength: number;
	maxPlayerNameLength: number;

	minCardsRequiredToStart: number;

	customSettingsLimit: CustomSettingsLimits;
}