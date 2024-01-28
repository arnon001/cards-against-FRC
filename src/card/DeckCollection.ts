import { Deck } from "./Deck";

export class DeckCollection {
	public name: string;
	public displayName: string;
	public description: string;

	public decks: Deck[];

	constructor(name: string, displayName: string, description: string, decks: Deck[]) {
		this.name = name;
		this.displayName = displayName;
		this.description = description;
		this.decks = decks;
	}

	public getName(): string {
		return this.name;
	}

	public getDisplayName(): string {
		return this.displayName;
	}

	public getDescription(): string {
		return this.description;
	}

	public getDecks(): Deck[] {
		return this.decks;
	}
}