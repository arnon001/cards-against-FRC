import { Socket } from "socket.io";
import { BlackCardDTO } from "./card/BlackCardDTO";
import { Deck } from "./card/Deck";
import { DeckCollectionDTO } from "./card/DeckCollectionDTO";
import { WhiteCardDTO } from "./card/WhiteCardDTO";
import { GamePhase } from "./enum/GamePhase";
import { GameStartResponse } from "./enum/GameStartResponse";
import { GameState } from "./enum/GameState";
import { JoinGameResponse } from "./enum/JoinGameResponse";
import { MessageType } from "./enum/MessageType";
import { Game } from "./Game";
import { ClientSettings } from "./interfaces/ClientSettings";
import { GameSettings } from "./interfaces/GameSettings";
import { ITickable } from "./interfaces/ITickable";
import { Player } from "./Player";
import { Utils } from "./Utils";
import Server from "./Server";

export class User implements ITickable {
	private socket: Socket;
	private uuid: string;
	private username: string;
	private _server: Server;

	constructor(server: Server, uuid: string, socket: Socket, username: string) {
		this._server = server;
		this.uuid = uuid;
		this.socket = socket;
		this.username = username;

		socket.on("disconnect", () => {
			this._server.disconnectUser(this);
		});

		socket.on("message", (message: string, content: any) => {
			this.handleIncommingMessage(message, content);
		});

		let clientSettings: ClientSettings = {
			maxPlayersPerGame: this._server.settings.maxPlayersPerGame,
			maxGameNameLength: this._server.settings.maxGameNameLength,
			maxPlayerNameLength: this._server.settings.maxPlayerNameLength,
			deckCollections: this._server.getDeckCollections().map(c => new DeckCollectionDTO(c)),
			uuid: this.getUUID(),

			initialGeneratedName: username,

			customSettingsLimit: this._server.settings.customSettingsLimit
		}

		socket.send("client_settings", clientSettings);
	}

	public getUUID(): string {
		return this.uuid;
	}

	public getSocket(): Socket {
		return this.socket;
	}

	public getUsername(): string {
		return this.username;
	}

	public setUsername(username: string): void {
		this.username = username;
	}

	public sendMessage(message: string, type: MessageType): void {
		this.socket.send("message", {
			"message": message,
			"type": type
		});
	}

	public getGame(): Game | null {
		for (let i: number = 0; i < this._server.games.length; i++) {
			let game = this._server.games[i];

			if (game.isInGame(this)) {
				return game;
			}
		}

		return null;
	}

	public isInGame(): boolean {
		return this.getGame() != null;
	}

	public handleIncommingMessage(message: string, content: any): void {
		let msgString: string = "" + message;
		try {
			switch (msgString) {
				case "create_game":
					if (content["game_name"] == undefined) {
						console.warn("[User] Received create_game without game_name from " + this.uuid);
						return;
					}

					let gamePassword: string | null = null;

					if (content["password"] != null) {
						gamePassword = content["password"] + "";
					}

					if (this.isInGame()) {
						console.log("[User] User " + this.uuid + " tried to create a game while already in one");
						this.sendMessage("You are already in a game", MessageType.WARNING);
						return;
					}

					let gameName = "" + content["game_name"];
					if (gameName.length == 0 || gameName.length > this._server.settings.maxGameNameLength) {
						console.log("[User] User " + this.uuid + " tried to create a game with an invalid name");
						this.sendMessage("Invalid game name", MessageType.WARNING);
						return;
					}

					console.log("[Game] User " + this.uuid + " created a game named " + gameName);
					this._server.createGame(this, gameName, gamePassword);

					break;

				case "join_game":
					if (content["uuid"] == undefined) {
						console.warn("[User] Received create_game without game_name from " + this.uuid);
						return;
					}

					if (this.isInGame()) {
						console.log("[User] User " + this.uuid + " tried to join a game while already in one");
						this.sendMessage("You are already in a game", MessageType.WARNING);
						return;
					}

					let uuid = "" + content["uuid"];
					let game: Game = this._server.getGame(uuid);
					let password: string | null = content["password"] != undefined ? content["password"] : null;

					if (game != null) {
						let response: JoinGameResponse = game.joinGame(this, password);
						if (response == JoinGameResponse.SUCCESS) {
							this.sendMessage("Joined " + game.getName(), MessageType.SUCCESS);
						} else if (response == JoinGameResponse.GAME_FULL) {
							this.sendMessage("That game is full", MessageType.ERROR);
						} else if (response == JoinGameResponse.INVALID_PASSWORD) {
							this.sendMessage("Invalid password", MessageType.ERROR);
						}
					} else {
						this.sendMessage("Game not found", MessageType.ERROR);
					}

					break;

				case "leave_game":
					if (!this.isInGame()) {
						console.log("[User] User " + this.uuid + " tried to leave a game while not in one");
						this.sendMessage("You are not in a game", MessageType.WARNING);
						return;
					}

					this.getGame().leaveGame(this);

					this.sendMessage("You left the game", MessageType.INFO);
					break;

				case "set_game_expanstions":
					if (content["expansions"] == undefined) {
						console.warn("[User] Received set_game_expanstions without expansions from " + this.uuid);
						return;
					}

					if (!this.isInGame()) {
						console.warn("[User] User " + this.uuid + " tried to set expansions while not in a game");
						this.sendMessage("You are not in a game", MessageType.WARNING);
						return;
					}

					if (!this.getGame().isHost(this)) {
						console.warn("[User] User " + this.uuid + " tried to set expansions while not being the host of the game");
						this.sendMessage("You are not the host of this game", MessageType.ERROR);
					}

					//console.debug(Object.entries(content["expansions"]));

					for (let [key, value] of Object.entries(content["expansions"])) {
						let name = key + "";
						let enabled = (value + "" == "true");

						//console.debug(name + " " + enabled);

						let deck: Deck | null = this._server.getDeck(name);

						if (deck == null) {
							console.warn("[User] User " + this.uuid + " tried to set the state of an invalid expansion: " + name);
							continue;
						}

						let hasDeck: boolean = this.getGame().hasDeck(deck);

						if (hasDeck) {
							if (!enabled) {
								console.log("[User] removing deck " + deck.getName() + " from session");
								this.getGame().removeDeck(deck);
							}
						} else {
							if (enabled) {
								console.log("[User] adding deck " + deck.getName() + " to session");
								this.getGame().addDeck(deck);
							}
						}
					}

					this.getGame().sendFullUpdate();

					break;

				case "start_game":
					if (!this.isInGame()) {
						console.warn("[User] User " + this.uuid + " tried to start a game while not in one");
						this.sendMessage("You are not in a game", MessageType.WARNING);
						return;
					}

					if (!this.getGame().isHost(this)) {
						console.warn("[User] User " + this.uuid + " tried to set start the game while not being the host");
						this.sendMessage("You are not the host of this game", MessageType.ERROR);
					}

					let response: GameStartResponse = this.getGame().startGame();

					switch (response) {
						case GameStartResponse.SUCCESS:
							this.getGame().broadcastMessage("Game started", MessageType.SUCCESS);
							break;

						case GameStartResponse.ALREADY_RUNNING:
							this.sendMessage("The game has already been started", MessageType.ERROR);
							break;

						case GameStartResponse.NOT_ENOUGH_PLAYERS:
							this.sendMessage("There needs to be atleast 3 players before the game can start", MessageType.ERROR);
							break;

						case GameStartResponse.NOT_ENOUGH_BLACK_CARDS:
							this.sendMessage("There are not enough black cards in the expansions you have selected. Please select more expansions and try again", MessageType.ERROR);
							break;

						case GameStartResponse.NOT_ENOUGH_WHITE_CARDS:
							this.sendMessage("There are not enough white cards in the expansions you have selected. Please select more expansions and try again", MessageType.ERROR);
							break;

						default:
							console.warn("Unknown game start response " + response);
							break;
					}

					break;

				case "select_cards":
					if (!Array.isArray(content["selected_cards"])) {
						console.warn("[User] Received select_cards without selected_cards array");
						return;
					}

					if (!this.isInGame()) {
						console.warn("[User] Tried to select cards while not in a game");
						return;
					}

					if (this.getGame().getPhase() != GamePhase.PICKING) {
						console.warn("[User] Tried to select cards while not in the picking phase");
						return;
					}

					let selected: string[] = content["selected_cards"];

					for (let i = 0; i < selected.length; i++) {
						for (let j = 0; j < selected.length; j++) {
							if (i == j) {
								continue;
							}

							if (selected[i] == selected[j]) {
								this.sendMessage("Duplicate cards selected", MessageType.ERROR);
								return;
							}
						}
					}

					let player: Player = this.getGame().getPlayerByUser(this);

					if (player.getSelectedCards().length > 0) {
						this.sendMessage("You have already selected cards for this round", MessageType.WARNING);
						return;
					}

					if (player == null) {
						this.sendMessage("Server error: Could not find player object", MessageType.ERROR);
						return;
					}

					let hand: string[] = player.getHand().map(c => c.getText());

					for (let i = 0; i < selected.length; i++) {
						if (!hand.includes(selected[i])) {
							this.sendMessage("You tried to play a card you do not have", MessageType.ERROR);
							return;
						}
					}

					player.setSelectedCards(selected);

					break;

				case "card_czar_select_cards":
					if (!this.isInGame()) {
						console.warn("[User] Tried to select winner cards while not in a game");
						return;
					}

					if (this.getGame().getPhase() != GamePhase.VOTING) {
						console.warn("[User] Tried to select winner cards while not in the voting phase");
						return;
					}

					let cardCzar: Player | null = this.getGame().getCardCzar();

					if (cardCzar == null) {
						console.warn("[User] Tried to select winner cards but the card czar is null");
						return;
					}

					if (cardCzar.getUUID() != this.uuid) {
						console.warn("[User] Tried to select winner cards but the user is not the card czar");
						this.sendMessage("You are not the card czar", MessageType.ERROR);
						return;
					}

					if (content["selected"] == null) {
						console.warn("[User] Tried to select winner cards but selected is null");
						return;
					}

					if (!this.getGame().selectWinner("" + content["selected"]).success) {
						console.warn("[User] Tried to select winner cards but it failed");
						this.sendMessage("Failed to select winner. Please try again", MessageType.ERROR);
					}

					break;

				case "set_name":
					if (this.isInGame()) {
						console.warn("[User] A user tried to change their name while in game");
						return;
					}

					if (content["name"] == null) {
						console.warn("[User] A user tried to change their name without sending a name variable");
						return;
					}

					let name = "" + content["name"];

					if (name == this.getUsername()) {
						return;
					}

					if (name.trim().length == 0) {
						this.sendMessage("You cant have an empty name", MessageType.ERROR);
						return;
					}

					if (name.length > this._server.settings.maxPlayerNameLength) {
						this.sendMessage("That name is too long", MessageType.ERROR);
						return;
					}


					console.log("[User] User " + this.getUUID() + " changed their name from " + this.getUsername() + " to " + name);
					this.setUsername(name);

					this.sendMessage("Name set to " + name, MessageType.SUCCESS);

					break;

				case "set_game_settings":
					this.processGameSettings(content);
					break;

				case "throw_away_card":
					if (!this.isInGame()) {
						console.warn("[User] A user tried to throw away card while not in game");
						return;
					}

					if (!this.getGame().getGameSettings().allowThrowingAwayCards) {
						this.sendMessage("This game does not allow you to throw away cards", MessageType.ERROR);
						return;
					}

					if (content["card"] == null) {
						console.warn("[User] A user tried to throw away card without sending a card variable");
						return;
					} else {
						let player: Player = this.getGame().getPlayerByUser(this);

						if (player == null) {
							console.error("Failed to throw away card. Player not found");
							return;
						}

						if (player.isThrowawayUsed()) {
							console.error("You can only throw away 1 card per round");
							return;
						}

						let card: string = content["card"] + "";

						var found = false;
						for (var i = 0; i < player.getHand().length; i++) {
							if (player.getHand()[i].getText() == card) {
								found = true;
								break;
							}
						}

						if (found) {
							//if (player.getHand().includes(card)) {
							let index: number = player.getHand().findIndex(c => c.getText() == card);

							if (index > -1) {
								player.getHand().splice(index, 1);
								player.setThrowawayUsed(true);
								this.sendActiveGameState();

								this.getGame().broadcastMessage(this.getUsername() + " threw away the card " + card, MessageType.INFO);
							}
							//}
						}
					}
					break;

				default:
					console.warn("[User] Invalid message received: " + message);
					break;
			}
		} catch (err) {
			console.warn("Exception caught while processing incomming data from player " + this.getUUID());
			console.error(err);
		}
	}

	public processGameSettings(content: any) {
		if (!this.isInGame()) {
			this.sendMessage("Cant change settings while not in game", MessageType.ERROR);
			return;
		}

		if (this.getGame().getHostUUID() != this.uuid) {
			this.sendMessage("You are not the host of this game", MessageType.ERROR);
			return;
		}

		if (this.getGame().getGameState() != GameState.WAITING) {
			this.sendMessage("Game is already running", MessageType.ERROR);
			return;
		}

		if (content["reset"] == true) {
			this.getGame().useDefaultSettings(true);
			this.sendMessage("Settings have been reset", MessageType.SUCCESS);
		} else {

			let allowThrowingAwayCards: boolean = this.getGame().getGameSettings().allowThrowingAwayCards;
			let handSize: number = this.getGame().getGameSettings().handSize;
			let maxRoundTime: number = this.getGame().getGameSettings().maxRoundTime;
			let winScore: number = this.getGame().getGameSettings().winScore;
			let showCardPack: boolean = this.getGame().getGameSettings().showCardPack;

			if (content["allow_throwaway_cards"] != null) {
				allowThrowingAwayCards = Utils.stringToBoolean(content["allow_throwaway_cards"]);
			}

			if (content["show_card_pack"] != null) {
				showCardPack = Utils.stringToBoolean(content["show_card_pack"]);
			}

			if (content["hand_size"] != null) {
				let input: number = parseInt(content["hand_size"]);
				if (!isNaN(input)) {
					if (input <= this._server.settings.customSettingsLimit.maxHandSize && input >= this._server.settings.customSettingsLimit.minHandSize) {
						handSize = input;
					}
				}
			}

			if (content["win_score"] != null) {
				let input: number = parseInt(content["win_score"]);
				if (!isNaN(input)) {
					if (input <= this._server.settings.customSettingsLimit.maxWinScore && input >= this._server.settings.customSettingsLimit.minWinScore) {
						winScore = input;
					}
				}
			}


			if (content["max_round_timer"] != null) {
				let input: number = parseInt(content["max_round_timer"]);
				if (!isNaN(input)) {
					if (input <= this._server.settings.customSettingsLimit.maxRoundTime && input >= this._server.settings.customSettingsLimit.minRoundTime) {
						maxRoundTime = input;
					}
				}
			}

			let newSettings: GameSettings = {
				allowThrowingAwayCards: allowThrowingAwayCards,
				handSize: handSize,
				maxRoundTime: maxRoundTime,
				winScore: winScore,
				showCardPack: showCardPack
			}

			//console.debug(newSettings);

			this.getGame().setCustomSettings(newSettings, true);
		}
	}

	public dispose(): void {
		if (this.isInGame()) {
			this.getGame().leaveGame(this);
		}
	}

	public sendActiveGameState(): void {
		let activeGameData: any | null = null;

		if (this.isInGame()) {
			let game: Game = this.getGame();

			let decks: string[] = [];

			game.getDecks().forEach((deck) => {
				decks.push(deck.getName());
			});

			let players: any[] = [];

			game.getPlayers().forEach((player) => {
				let done: boolean = player.getSelectedCards().length > 0;

				players.push({
					uuid: player.getUUID(),
					username: player.getUser().getUsername(),
					score: player.getScore(),
					done: done
				});
			});

			let player: Player = game.getPlayers().find((p) => p.getUUID() == this.getUUID());

			let hand: WhiteCardDTO[] = [];
			let throwawayUsed: boolean = false;

			if (player != null) {
				hand = player.getHand().map(c => new WhiteCardDTO(c));
				throwawayUsed = player.isThrowawayUsed();
			}

			let cardCzar: string | null = null;

			if (game.getCardCzar() != null) {
				cardCzar = game.getCardCzar().getUUID();
			}

			let activeBlackCard: BlackCardDTO | null = null;

			if (game.getActiveBlackCard() != null) {
				activeBlackCard = new BlackCardDTO(game.getActiveBlackCard())
			}

			activeGameData = {
				uuid: game.getUUID(),
				name: game.getName(),
				state: game.getGameState(),
				decks: decks,
				host: game.getHostUUID(),
				players: players,
				black_card: activeBlackCard,
				hand: hand,
				phase: game.getPhase(),
				card_czar: cardCzar,
				winner_selected: game.isWinnerSelected(),
				custom_settings_string: game.getCustomSettingsString(),
				settings: game.getGameSettings(),
				throwaway_used: throwawayUsed
			};
		}

		let state = {
			active_game: activeGameData
		}

		this.socket.send("state", state);
	}

	public tick(): void { }
}