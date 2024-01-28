import { ICardDTO } from "./ICardDTO";
import { WhiteCard } from "./WhiteCard";

export class WhiteCardDTO implements ICardDTO {
	public deck_name: string;
	public text: string;

	constructor(blackCard: WhiteCard) {
		this.deck_name = blackCard.deck.getDisplayName();
		this.text = blackCard.getText();
	}
}