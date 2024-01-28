const fs = require('fs');

const data = require("./cah-cards-full.json");

for (let i = 0; i < data.length; i++) {
	const pack = data[i];

	const fileName = pack.name.replace(/ /g, "_").replace(/:/g, "").replace(/"/g, '').replace(/\*/g, "").replace(/\\/g, "_").replace(/[!?]/g, "").replace(/\//g, "_");

	const exported = {
		order: i,
		name: pack.name,
		filename: fileName,
		black_cards: [],
		white_cards: []
	}

	for (let i = 0; i < pack.white.length; i++) {
		const white = pack.white[i];
		exported.white_cards.push(white.text);
	}

	for (let i = 0; i < pack.black.length; i++) {
		const black = pack.black[i];
		exported.black_cards.push({
			text: black.text,
			pick: black.pick
		});
	}

	fs.writeFile("out/" + fileName + ".json", JSON.stringify(exported, null, 4), 'utf8', function (err) {
		if (err) {
			console.log("An error occurred while writing JSON Object to File.");
			return console.log(err);
		}

		console.log("Saved " + fileName + ".json");
	});
}