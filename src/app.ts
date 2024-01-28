import * as FS from "fs";
import { Settings } from "./interfaces/Settings";
import Server from "./Server";

require('console-stamp')(console, '[HH:MM:ss.l]');

if (!FS.existsSync("./config")) {
	FS.mkdirSync("./config");
}

if (!FS.existsSync("./config/config.json")) {
	console.log("Creating default configuration");
	let defaultConfig: Settings = {
		port: 8080,

		maxPlayersPerGame: 10,

		maxGameNameLength: 40,
		maxPlayerNameLength: 40,

		minCardsRequiredToStart: 1,

		customSettingsLimit: {
			minHandSize: 5,
			maxHandSize: 100,

			minRoundTime: 1,
			maxRoundTime: 600,

			minWinScore: 1,
			maxWinScore: 9999
		}
	};
	FS.writeFileSync("./config/config.json", JSON.stringify(defaultConfig, null, 4), 'utf8');
}

let config: Settings = JSON.parse(FS.readFileSync("./config/config.json", 'utf8'));

if(process.env.PORT != null) {
	console.log("process.env.PORT is " + process.env.PORT);
	config.port = parseInt(process.env.PORT);
}

new Server(config);