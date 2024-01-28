import { CustomSettingsLimits } from "./CustomSettingsLimits";

export interface ClientSettings {
	maxPlayersPerGame: number;
	maxGameNameLength: number;
	maxPlayerNameLength: number;
	deckCollections: any[];
	uuid: string;
	initialGeneratedName: string;

	customSettingsLimit: CustomSettingsLimits;
}