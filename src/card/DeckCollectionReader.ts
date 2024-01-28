import * as fs from 'fs';
import { BlackCard } from './BlackCard';
import { Deck } from './Deck';
import { DeckCollection } from './DeckCollection';
import { WhiteCard } from './WhiteCard';

export class DeckCollectionReader {
	static readDeckCollections(): DeckCollection[] {
		console.log("Reading collections.json");

		let sets: any[] = JSON.parse(fs.readFileSync('./decks/collections.json', 'utf8'));

		let deckSets: DeckCollection[] = [];

		for (let i = 0; i < sets.length; i++) {
			let setData: any = sets[i];

			let name = setData.name;
			let displayName = setData.display_name;
			let description = setData.description;

			let decks: Deck[] = DeckCollectionReader.readFolder("./decks/" + name + "/");

			let set: DeckCollection = new DeckCollection(name, displayName, description, decks);
			deckSets.push(set);
		}

		return deckSets;
	}

	private static readFolder(path: string): Deck[] {
		let decks: Deck[] = [];

		let files: string[] = fs.readdirSync(path);

		for (let i = 0; i < files.length; i++) {
			let file = files[i];

			if(!file.toLocaleLowerCase().endsWith(".json")) {
				continue;
			}

			console.log("Parsing deck from: " + file);

			let json: any = JSON.parse(fs.readFileSync(path + file, 'utf8'));

			let order: number = json.order;
			let name: string = json.filename;
			let displayName: string = json.name;

			let deck: Deck = new Deck(name, displayName, order);

			let blackCards: BlackCard[] = [];
			let whiteCards: WhiteCard[] = [];

			for (let i = 0; i < json.black_cards.length; i++) {
				let text: string = "" + json.black_cards[i].text;
				let pick: number = json.black_cards[i].pick;

				let card: BlackCard = new BlackCard(deck, text, pick);

				blackCards.push(card);
			}

			for (let i = 0; i < json.white_cards.length; i++) {
				let text: string = "" + json.white_cards[i];

				let card: WhiteCard = new WhiteCard(deck, text);

				whiteCards.push(card);
			}

			deck.setContent(blackCards, whiteCards);
			
			console.log("Read pack " + displayName + " (" + name + ") With " + blackCards.length + " black cards and " + whiteCards.length + " white cards");

			decks.push(deck);
		}

		console.log("Sorting decks");
		decks.sort(function (a, b) {
			return a.getOrder() - b.getOrder();
		});

		return decks;
	}
}