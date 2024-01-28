import { BlackCardDTO } from "./BlackCardDTO";
import { Deck } from "./Deck";
import { WhiteCardDTO } from "./WhiteCardDTO";

export class DeckDTO {
	public name: string;
	public displayName: string;
	public order: number;
	public blackCards: BlackCardDTO[] = [];
	public whiteCards: WhiteCardDTO[] = [];

	constructor(deck: Deck) {
		this.name = deck.getName();
		this.displayName = deck.getDisplayName();
		this.order = deck.getOrder();
		this.blackCards = deck.getBlackCards().map(c => new BlackCardDTO(c));
		this.whiteCards = deck.getWhiteCards().map(c => new WhiteCardDTO(c));
	}
}