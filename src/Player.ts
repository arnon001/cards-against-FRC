import { WhiteCard } from "./card/WhiteCard";
import { Game } from "./Game";
import { User } from "./User";

export class Player {
	private user: User;
	private score: number;
	private hand: WhiteCard[];
	private _game: Game;
	private selectedCards: string[];
	private trowawayUsed: boolean;

	constructor(game: Game, user: User) {
		this.user = user;
		this.score = 0;
		this.hand = [];
		this.selectedCards = [];
		this._game = game;
		this.trowawayUsed = false;
	}

	public getHand(): WhiteCard[] {
		return this.hand;
	}

	public clearHand(): void {
		this.hand = [];
	}

	public getScore(): number {
		return this.score;
	}

	public setScore(score: number) {
		this.score = score;
	}

	public getUser(): User {
		return this.user;
	}

	public getUUID(): string {
		return this.user.getUUID();
	}

	public clearSelectedCards(): void {
		this.selectedCards = [];
	}

	public getSelectedCards(): string[] {
		return this.selectedCards;
	}

	public setSelectedCards(selected: string[]): void {
		this.selectedCards = selected;
		this._game.onPlayerSelectCards(this);
	}

	public isThrowawayUsed(): boolean {
		return this.trowawayUsed;
	}

	public setThrowawayUsed(used: boolean) {
		this.trowawayUsed = used;
	}
}