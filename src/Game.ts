import { BlackCard } from "./card/BlackCard";
import { Deck } from "./card/Deck";
import { WhiteCard } from "./card/WhiteCard";
import { GameEndReason } from "./enum/GameEndReason";
import { GamePhase } from "./enum/GamePhase";
import { GameStartResponse } from "./enum/GameStartResponse";
import { GameState } from "./enum/GameState";
import { JoinGameResponse } from "./enum/JoinGameResponse";
import { MessageType } from "./enum/MessageType";
import { GameSettings } from "./interfaces/GameSettings";
import { ITickable } from "./interfaces/ITickable";
import { Player } from "./Player";
import { User } from "./User";
import { Utils } from "./Utils";
import { v4 as uuidv4 } from 'uuid';
import { SelectWinnerResponse } from "./enum/SelectWinnerResponse";
import { WhiteCardDTO } from "./card/WhiteCardDTO";
import Server from "./Server";

export class Game implements ITickable {
	private uuid: string;
	private name: string;
	private players: Player[];
	private gameState: GameState;
	private settings: GameSettings;
	private decks: Deck[];
	private gamePhase: GamePhase;

	private activeBlackCard: BlackCard | null;

	private blackCardDeck: BlackCard[];
	private whiteCardDeck: WhiteCard[];

	private cardCzar: number;

	private _server: Server;

	private timeLeft;

	private votingHashes: any;
	private startVotingDataCache: any; // used for people who join during voting

	private password: string;

	private customSettingsString: string;

	private winnerSelected: boolean;

	constructor(server: Server, uuid: string, name: string, password: string | null = null) {
		this._server = server;
		this.uuid = uuid;
		this.name = name;
		this.gameState = GameState.WAITING;
		this.votingHashes = {};
		this.winnerSelected = false;
		this.customSettingsString = "None";
		this.useDefaultSettings(false); // false to not cause a game update
		this.password = password;

		this.activeBlackCard = null;

		this.cardCzar = 0;

		this.gamePhase = GamePhase.PICKING;

		this.whiteCardDeck = [];
		this.blackCardDeck = [];
		this.decks = [];
		this.players = [];
		this.timeLeft = -1;
		this.startVotingDataCache = null;

		let defaultDeck: Deck | null = this._server.getDeck("xyzzy_base_game_(international)");
		if (defaultDeck != null) {
			this.decks.push(defaultDeck);
		}
	}

	public destroyInstance(): void {
		this.players = [];
		this.name = "[deleted]";
	}

	/* ===== Getters and setters ===== */
	public getUUID(): string {
		return this.uuid;
	}

	public getName(): string {
		return this.name;
	}

	public getGameSettings(): GameSettings {
		return this.settings;
	}

	public getHostUUID(): string | null {
		if (this.players.length > 0) {
			return this.players[0].getUUID();
		}

		return null;
	}

	public getGameState(): GameState {
		return this.gameState;
	}

	public getPlayers(): Player[] {
		return this.players;
	}

	public getDecks(): Deck[] {
		return this.decks;
	}

	public getCardCzar(): Player | null {
		if (this.cardCzar >= this.players.length) {
			return null;
		}

		return this.players[this.cardCzar];
	}

	public getPhase(): GamePhase {
		return this.gamePhase;
	}

	public getActiveBlackCard(): BlackCard | null {
		return this.activeBlackCard;
	}

	public getPlayerByUser(user: User): Player | null {
		return this.players.find(p => p.getUUID() == user.getUUID());
	}

	public getPassword(): string {
		return this.password;
	}

	public useDefaultSettings(update: boolean = true): void {
		this.settings = Utils.cloneObject(this._server.defaultGameSettings);
		this.updateSustomSettingsString();
		if (update) {
			this.sendFullUpdate();
		}
	}

	public getCustomSettingsString(): string {
		return this.customSettingsString;
	}

	public setCustomSettings(settings: GameSettings, update: boolean = true): void {
		this.settings = settings;
		this.updateSustomSettingsString();
		if (update) {
			this.sendFullUpdate();
		}
	}

	/* ===== Custom settings ===== */
	public updateSustomSettingsString(): void {
		let result: string = "";

		if (this.settings.allowThrowingAwayCards != this._server.defaultGameSettings.allowThrowingAwayCards) {
			result += "Allow throwing away cards, ";
		}

		if (this.settings.handSize != this._server.defaultGameSettings.handSize) {
			result += "Hand size: " + this.settings.handSize + ", ";
		}

		if (this.settings.winScore != this._server.defaultGameSettings.winScore) {
			result += "Win score: " + this.settings.winScore + ", ";
		}

		if (this.settings.maxRoundTime != this._server.defaultGameSettings.maxRoundTime) {
			result += "Max round time: " + this.settings.maxRoundTime + ", ";
		}

		if (this.settings.showCardPack) {
			result += "Show expansion name, ";
		}

		if (result.length == 0) {
			result = "None";
		} else {
			// Remove space and comma at the end
			result = result.trim();
			result = result.substring(0, result.length - 1);
		}

		this.customSettingsString = result;
	}

	/* ===== Functions to determine if things are true ===== */
	public isWinnerSelected(): boolean {
		return this.winnerSelected;
	}

	public isInGame(user: User): boolean {
		for (let i: number = 0; i < this.players.length; i++) {
			if (this.players[i].getUUID() == user.getUUID()) {
				return true;
			}
		}

		return false;
	}

	public isHost(user: User): boolean {
		return this.getHostUUID() == user.getUUID();
	}

	public isAllPlayersDone(): boolean {
		let allDone = true;
		let cardCzar: Player = this.getCardCzar();

		this.players.forEach(p => {
			if (cardCzar != null) {
				if (cardCzar.getUUID() == p.getUUID()) {
					return;
				}
			}

			if (p.getSelectedCards().length == 0) {
				allDone = false;
			}
		});

		return allDone;
	}

	public hasPassword(): boolean {
		return this.password != null;
	}

	/* ===== Join and leave ===== */
	public joinGame(user: User, password: string | null = null, forceJoin: boolean = false): JoinGameResponse {
		if (this.hasPassword() && !forceJoin) {
			if (this.getPassword() != password) {
				return JoinGameResponse.INVALID_PASSWORD;
			}
		}

		if (this.players.length >= this._server.settings.maxPlayersPerGame && !forceJoin) {
			return JoinGameResponse.GAME_FULL;
		}

		for (let i = 0; i < this.players.length; i++) {
			this.players[i].getUser().sendMessage(user.getUsername() + " joined the game", MessageType.INFO);
		}

		let player: Player = new Player(this, user);

		this.players.push(player);

		if (this.gameState == GameState.INGAME) {
			this.fillPlayerHand(player);
		}

		this.sendFullUpdate();

		if (this.gamePhase == GamePhase.VOTING && this.gameState == GameState.INGAME) {
			// send voting state to user
			console.debug("Sending voting_start to a player that joined late");
			player.getUser().getSocket().send("voting_start", this.startVotingDataCache);
		}

		return JoinGameResponse.SUCCESS;
	}

	public leaveGame(user: User): void {
		let cardCzarPlayer: Player = this.getCardCzar();
		let skipRound: boolean = false;

		if (cardCzarPlayer != null) {
			if (user.getUUID() == cardCzarPlayer.getUUID()) {
				skipRound = true;
			}
		}

		for (let i: number = 0; i < this.players.length; i++) {
			if (this.players[i].getUUID() == user.getUUID()) {
				//console.debug(this.cardCzar + " | " + i + " | " + (this.cardCzar <= i) + " | " + (this.cardCzar > 0));

				if (this.cardCzar > i && this.cardCzar > 0) {
					// Keep the same player as card czar
					this.cardCzar--;
				}
				this.players.splice(i, 1);
				break;
			}
		}

		if (this.players.length == 0) {
			this._server.removeGame(this);
			this.sendStateUpdate(user); // user also needs to receive the state update
		} else {
			this.sendFullUpdate(user); // user also needs to receive the state update
			for (let i = 0; i < this.players.length; i++) {
				this.players[i].getUser().sendMessage(user.getUsername() + " left the game", MessageType.INFO);
			}

			if (this.players.length < 3 && this.gameState == GameState.INGAME) {
				this.endGame(GameEndReason.NOT_ENOUGH_PLAYERS);
				return;
			} else {
				if (skipRound) {
					this.players.forEach(player => player.clearSelectedCards());
					this.startRound();
					this.broadcastMessage("Round skupped because the card czar left", MessageType.WARNING);
				}
			}
		}

		if (this.gameState == GameState.INGAME && this.gamePhase == GamePhase.PICKING && !skipRound) {
			if (this.isAllPlayersDone()) {
				this.startVotingPhase();
			}
		}
	}

	/* ===== Deck related ===== */
	public hasDeck(deck: Deck): boolean {
		for (let i = 0; i < this.decks.length; i++) {
			if (this.decks[i].getName() == deck.getName()) {
				return true;
			}
		}

		return false;
	}

	public removeDeck(deck: Deck): void {
		for (let i = 0; i < this.decks.length; i++) {
			if (this.decks[i].getName() == deck.getName()) {
				this.decks.splice(i, 1);
				break;
			}
		}
	}

	public fillPlayerHand(player: Player): void {
		let tries = 0;
		let maxTries = 10000;

		while (player.getHand().length < this.settings.handSize) {
			tries++;
			let card: WhiteCard = this.getWhiteCard();

			var found = false;
			for (var i = 0; i < player.getHand().length; i++) {
				if (player.getHand()[i].getText() == card.getText()) {
					found = true;
					break;
				}
			}
			if (!found) {
				player.getHand().push(card);
			}





			// Prevent soft lock
			if (tries > maxTries) {
				console.error("Failed to fill the hand of " + player.getUser().getUsername() + " within " + maxTries + " tries in game " + this.getName());
				return;
			}
		}
	}

	public getWhiteCard(): WhiteCard {
		if (this.whiteCardDeck.length == 0) {
			this.decks.forEach((deck) => {
				deck.getWhiteCards().forEach((card) => {
					this.whiteCardDeck.push(card);
				});
			});

			Utils.shuffle(this.whiteCardDeck);
		}

		//return this.getWhiteCards().splice(Math.floor(Math.random() * this.getWhiteCards().length), 1)[0];

		return this.whiteCardDeck.pop();
	}

	public getBlackCard(): BlackCard {
		if (this.blackCardDeck.length == 0) {
			this.decks.forEach((deck) => {
				deck.getBlackCards().forEach((card) => {
					this.blackCardDeck.push(card);
				});
			});

			Utils.shuffle(this.blackCardDeck);
		}

		return this.blackCardDeck.pop();
	}

	public addDeck(deck: Deck) {
		this.decks.push(deck);
	}

	public getBlackCards(): BlackCard[] {
		let result: BlackCard[] = [];

		for (let i = 0; i < this.decks.length; i++) {
			let deck: Deck = this.decks[i];

			for (let j = 0; j < deck.getBlackCards().length; j++) {
				result.push(deck.getBlackCards()[i]);
			}
		}

		return result;
	}

	public getWhiteCards(): WhiteCard[] {
		let result: WhiteCard[] = [];

		for (let i = 0; i < this.decks.length; i++) {
			let deck: Deck = this.decks[i];

			for (let j = 0; j < deck.getWhiteCards().length; j++) {
				result.push(deck.getWhiteCards()[i]);
			}
		}

		return result;
	}

	/* ===== Rounds ===== */
	public startRound(): void {
		this.cardCzar++;
		this.winnerSelected = false;
		if (this.cardCzar >= this.players.length) {
			this.cardCzar = 0;
		}

		this.players.forEach(player => {
			if (player.getScore() >= this.settings.winScore) {
				this.endGame(GameEndReason.WIN);

				this.players.forEach(p => {
					p.getUser().getSocket().send("game_winner", {
						uuid: player.getUUID()
					});
				});

				return;
			}
		});

		this.gamePhase = GamePhase.PICKING;
		this.timeLeft = this.settings.maxRoundTime * 10;

		this.players.forEach((player) => {
			player.clearSelectedCards();
			player.setThrowawayUsed(false);
			this.fillPlayerHand(player);
		});

		this.activeBlackCard = this.getBlackCard();

		this.sendStateUpdate();

		this.players.forEach((player) => {
			player.getUser().getSocket().send("round_start", {});
		});
	}

	public startVotingPhase(): void {
		this.gamePhase = GamePhase.VOTING;
		this.timeLeft = this.settings.maxRoundTime * 10;
		this.winnerSelected = false;

		// check if any players has selected cards
		let shouldContinue = false;
		this.players.forEach(player => {
			if (player.getSelectedCards().length > 0) {
				shouldContinue = true;
			}
		});

		if (!shouldContinue) {
			this.broadcastMessage("Skipping round due to no players selecting cards", MessageType.WARNING);
			this.startRound();
			return;
		}

		this.votingHashes = {};

		let selectedSets: any[] = [];

		this.players.forEach(player => {
			if (player.getSelectedCards().length > 0) {
				let hash = Utils.md5String(player.getUUID() + uuidv4());

				this.votingHashes[hash] = player.getUUID();

				let selectedCards: WhiteCard[] = [];

				player.getSelectedCards().forEach(s => {
					let found = false;
					this.decks.forEach(deck => {
						if (found) {
							return;
						}

						deck.getWhiteCards().forEach(c => {
							if(found) {
								return;
							}

							if(c.getText() == s) {
								selectedCards.push(c);
								found = true;
							}
						});
					});
				});


				selectedSets.push({
					hash: hash,
					selected: selectedCards.map(c => new WhiteCardDTO(c))
				});
			}
		});

		// Shuffle array so that the cards will be displayed in a random order instead of the same every time.
		// This is used to prevent players from cheating by memorising the location of each player.
		Utils.shuffle(selectedSets);

		this.startVotingDataCache = {
			selected_sets: selectedSets
		};

		this.players.forEach(player => player.getUser().getSocket().send("voting_start", this.startVotingDataCache));

		this.sendStateUpdate();
	}

	/* ===== Networking ===== */
	public broadcastMessage(message: string, type: MessageType): void {
		this.players.forEach((player) => {
			player.getUser().sendMessage(message, type);
		});
	}

	public sendStateUpdate(includeUser: User = null): void {
		let target: User[] = [];

		this.players.forEach((p) => {
			target.push(p.getUser());
		});

		if (includeUser != null) {
			target.push(includeUser);
		}

		target.forEach((user) => {
			user.sendActiveGameState();
		});
	}

	public sendFullUpdate(includeUser: User = null): void {
		this.sendStateUpdate(includeUser);
	}

	/* ===== Starting and ending game ===== */
	public startGame(): GameStartResponse {
		if (this.gameState == GameState.INGAME) {
			return GameStartResponse.ALREADY_RUNNING;
		}

		if (this.getBlackCards().length < this._server.settings.minCardsRequiredToStart) {
			return GameStartResponse.NOT_ENOUGH_BLACK_CARDS;
		}

		if (this.getWhiteCards().length < this._server.settings.minCardsRequiredToStart) {
			return GameStartResponse.NOT_ENOUGH_WHITE_CARDS;
		}

		if (this.players.length < 3) {
			return GameStartResponse.NOT_ENOUGH_PLAYERS;
		}

		// Clear cards from previous round
		this.blackCardDeck = [];
		this.whiteCardDeck = [];

		this.players.forEach((player) => {
			player.clearHand();
			player.setScore(0);
		});

		this.cardCzar = 0;
		this.winnerSelected = false;

		this.gameState = GameState.INGAME;

		this.startRound();

		return GameStartResponse.SUCCESS;
	}

	public endGame(reason: GameEndReason): void {
		if (this.gameState == GameState.INGAME) {
			this.gameState = GameState.WAITING;

			this.blackCardDeck = [];
			this.whiteCardDeck = [];

			this.players.forEach((player) => {
				player.clearHand();
				player.setScore(0);
			});

			switch (reason) {
				case GameEndReason.WIN:
					//TODO: win message
					this.broadcastMessage("Game over", MessageType.SUCCESS);
					break;

				case GameEndReason.NOT_ENOUGH_PLAYERS:
					this.broadcastMessage("Game ended due to there not being enough players left", MessageType.WARNING);
					break;

				default:
					this.broadcastMessage("Game ended", MessageType.INFO);
					console.error("Invalid game end reason " + reason);
					break;
			}

			this.sendFullUpdate();
		}
	}

	/* ===== Player game interactions ===== */
	public onPlayerSelectCards(player: Player): void {
		if (this.gamePhase != GamePhase.PICKING) {
			return;
		}

		let allDone: boolean = this.isAllPlayersDone();

		if (allDone) {
			this.startVotingPhase();
		} else {
			this.sendStateUpdate();
			player.getUser().getSocket().send("cards_selected_success", {});
		}
	}

	public selectWinner(hash: string): SelectWinnerResponse {
		if (this.gameState != GameState.INGAME || this.gamePhase != GamePhase.VOTING) {
			console.warn("Tried to select winner while not in the ingame voting state");
			return { success: false };
		}

		if (this.winnerSelected) {
			console.warn("Tried to select winner while the winner has already been declared");
			return { success: false };
		}

		if (this.votingHashes[hash] == undefined) {
			console.warn("Invalid winner hash: " + hash);
			return { success: false };
		}

		let uuid = this.votingHashes[hash];

		let player = this.players.find(p => p.getUUID() == uuid);

		this.winnerSelected = true;

		if (player != null) {
			player.setScore(player.getScore() + 1);
		}

		this.players.forEach(player => {
			player.getUser().getSocket().send("round_winner", {
				uuid: uuid,
				hash: hash
			});

			player.getSelectedCards().forEach(card => {
				let index = player.getHand().findIndex(c => c.getText() == card);
				if (index != -1) {
					player.getHand().splice(index, 1);
				}

				//let index = player.getHand().indexOf(card, 0);
				//player.getHand().splice(index, 1);
			});
		});

		this.sendStateUpdate();

		this.timeLeft = -1;

		console.log("[Game] Winner selected. Starting next round in 4 seconds");

		setTimeout(() => {
			if (this.getPhase() == GamePhase.VOTING && this.getGameState() == GameState.INGAME) {
				this.startRound();
			}
		}, 4000);

		return {
			success: true,
			player: player
		};
	}

	/* ===== Game loop ===== */
	public tick(): void {
		//console.debug(this.cardCzar);

		if (this.gameState == GameState.INGAME) {
			if (this.timeLeft >= 0) {
				if (this.timeLeft % 10 == 0) {
					this.players.forEach((player) => {
						player.getUser().getSocket().send("time_left", {
							time: Math.floor(this.timeLeft / 10)
						});
					});
				}

				if (this.timeLeft == 0) {
					//console.debug("Game timed out at phase " + this.gamePhase);
					switch (this.gamePhase) {
						case GamePhase.PICKING:
							this.broadcastMessage("Some players did not select cards in time", MessageType.WARNING);
							this.startVotingPhase();
							break;

						case GamePhase.VOTING:
							this.broadcastMessage("The card czar did not pick a card in time", MessageType.WARNING);
							this.players.forEach(player => player.clearSelectedCards());
							this.startRound();
							break;
					}
				}

				this.timeLeft--;
			}
		}
	}
}