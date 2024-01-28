import { ICard } from "./ICard";
import { Deck } from "./Deck";

export class WhiteCard implements ICard {
	public deck: Deck;
	public text: string;

	constructor(deck: Deck, text: string) {
		this.deck = deck;
		this.text = text;
	}

	public getDeck(): Deck {
		return this.deck;
	}

	public getText(): string {
		return this.text;
	}
}