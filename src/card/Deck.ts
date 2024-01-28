import { BlackCard } from "./BlackCard";
import { WhiteCard } from "./WhiteCard";

export class Deck {
	private name: string;
	private displayName: string;
	private order: number;
	private blackCards: BlackCard[] = [];
	private whiteCards: WhiteCard[] = [];


	constructor(name: string, displayName: string, order: number) {
		this.name = name;
		this.displayName = displayName;
		this.order = order;
		this.blackCards = [];
		this.whiteCards = [];
	}

	public setContent(blackCards: BlackCard[], whiteCards: WhiteCard[]) {
		this.blackCards = blackCards;
		this.whiteCards = whiteCards;
	}

	public getName(): string {
		return this.name;
	}

	public getDisplayName(): string {
		return this.displayName;
	}

	public getOrder(): number {
		return this.order;
	}

	public getBlackCards(): BlackCard[] {
		return this.blackCards;
	}

	public getWhiteCards(): WhiteCard[] {
		return this.whiteCards;
	}
}