import { ICard } from "./ICard";
import { Deck } from "./Deck";

export class BlackCard implements ICard {
	public deck: Deck;
	public text: string;
	public pick: number;

	constructor(deck: Deck, text: string, pick: number) {
		this.deck = deck;
		this.text = text;
		this.pick = pick;
	}

	public getDeck(): Deck {
		return this.deck;
	}

	public getText(): string {
		return this.text;
	}

	public getPick(): number {
		return this.pick;
	}
}