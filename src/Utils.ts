import * as crypto from 'crypto';

export class Utils {
	public static getRandomInt(min: number, max: number): number {
		return Math.trunc(Math.random() * (max - min) + min);
	}

	public static shuffle<T>(array: T[]): T[] {
		var currentIndex = array.length, randomIndex;

		// While there remain elements to shuffle...
		while (currentIndex != 0) {

			// Pick a remaining element...
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex--;

			// And swap it with the current element.
			[array[currentIndex], array[randomIndex]] = [
				array[randomIndex], array[currentIndex]];
		}

		return array;
	}

	public static md5String(string: string): string {
		return crypto.createHash("md5").update(string).digest("hex");
	}

	public static cloneObject<T>(object: T): T {
		return JSON.parse(JSON.stringify(object));
	}

	public static stringToBoolean(object: any): boolean {
		let string: string = String(object);
		switch (string.toLowerCase().trim()) {
			case "true": case "yes": case "1": return true;
			case "false": case "no": case "0": case null: return false;
			default: return Boolean(string);
		}
	}
}