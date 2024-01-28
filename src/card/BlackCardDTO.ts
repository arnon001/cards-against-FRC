import { BlackCard } from "./BlackCard";
import { ICardDTO } from "./ICardDTO";

export class BlackCardDTO implements ICardDTO {
	public deck_name: string;
	public text: string;
	public pick: number;

	constructor(blackCard: BlackCard) {
		this.deck_name = blackCard.deck.getDisplayName();
		this.pick = blackCard.getPick();
		this.text = blackCard.getText();
	}
}