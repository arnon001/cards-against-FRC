import { DeckCollection } from "./DeckCollection";
import { DeckDTO } from "./DeckDTO";

export class DeckCollectionDTO {
	public name: string;
	public displayName: string;
	public description: string;

	public decks: DeckDTO[];

	constructor(deckCollection: DeckCollection) {
		this.name = deckCollection.getName();
		this.displayName = deckCollection.getDisplayName();
		this.description = deckCollection.getDescription();

		this.decks = deckCollection.getDecks().map(d => new DeckDTO(d));
	}
}