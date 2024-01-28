const socket = io();

var gameConfig = null;
var activeGame = null;
var ready = false;
var myUUID = null;

var selectedCards = [];

var disconnected = false;

var cardCzarSelected = null;

var debugMode = true;

var throwawayMode = false;

socket.on("message", function (message, content) {
	// This is to prevent the player from going into a weird invalid game state when the server restarts
	if (disconnected) {
		return;
	}

	switch (message) {
		case "message":
			handleMessage(content);
			break;

		case "state":
			handleGameState(content);
			break;

		case "round_start":
			handleRoundStart(content);
			break;

		case "client_settings":
			console.log("Received client configuration from server");
			gameConfig = content;
			myUUID = gameConfig.uuid;
			ready = true;
			$("#tbx_userName").val(gameConfig.initialGeneratedName);
			setupExpansions();
			setupGameSettingsLimits();
			loadStoredName();
			updateGameList();
			break;

		case "cards_selected_success":
			toastr.success("Cards selected");
			updateSelectionNumbers();
			break;

		case "time_left":
			$("#time_left").text(content.time);
			break;

		case "voting_start":
			handleVotingStart(content);
			break;

		case "round_winner":
			let winner = "[Unknown player]"

			activeGame.players.forEach(player => {
				if (player.uuid == content.uuid) {
					winner = player.username;
				}
			});

			console.log("This rounds winner is: " + winner);
			$("#round_winner_text").text("This rounds winner is: " + winner);
			$("#round_winner_text").show();

			let hash = content.hash;

			$(".played-card-set").each(function () {
				if ($(this).data("hash") == hash) {
					$(this).addClass("card-czar-selected");
				}
			});

			break;

		case "game_winner":
			handleGameWinner(content);
			break;

		default:
			console.warn("invalid packet: " + message);
			break;
	}
});

socket.on("disconnect", () => {
	toastr.error("Please reload the page", "Disconnected");
	$("#disconnected_message_full").removeClass("d-none");
	disconnected = true;
});

function handleGameWinner(data) {
	let winnerUUID = data.uuid;
	let winnerName = "[Unknown player]";

	if (activeGame != null) {
		activeGame.players.forEach(player => {
			if (player.uuid == winnerUUID) {
				winnerName = player.username;
			}
		});
	}

	$.alert({
		title: 'Game over!',
		theme: (activeTheme.is_dark ? "dark" : "light"),
		content: 'Winner: ' + winnerName,
	});
}

function getDeck(name) {
	let result = null;

	gameConfig.deckCollections.forEach((deckCollection) => {
		deckCollection.decks.forEach((deck) => {
			if (deck.name == name) {
				result = deck;
			}
		});
	});

	return result;
}

function loadStoredName() {
	if (window.localStorage.getItem("name") != null) {
		let name = window.localStorage.getItem("name");

		if (name.length == 0) {
			return;
		}

		console.log("Using stored name " + name);

		$("#tbx_userName").val(name);

		socket.send("set_name", {
			name: name
		});
	}
}

function joinGame(uuid, password = null) {
	socket.send("join_game", {
		uuid: uuid,
		password: password
	});
}

function joinPasswordProtected(uuid) {
	$.confirm({
		title: 'Enter game password!',
		content: '' +
			'<form action="" class="password-form">' +
			'<div class="form-group">' +
			'<label>This game is password protected</label>' +
			'<input type="password" placeholder="Password" class="input-password form-control" required />' +
			'</div>' +
			'</form>',
		theme: (activeTheme.is_dark ? "dark" : "light"),
		buttons: {
			formSubmit: {
				text: 'Submit',
				btnClass: 'btn-blue',
				action: function () {
					var password = this.$content.find('.input-password').val();

					joinGame(uuid, password);
				}
			},
			cancel: function () {
				//close
			},
		},
		onContentReady: function () {
			// bind to events
			var jc = this;
			this.$content.find('form').on('submit', function (e) {
				// if the user submits the form by pressing enter in the field.
				e.preventDefault();
				jc.$$formSubmit.trigger('click'); // reference the button and click it
			});
		}
	});
}

function handleGameList(games) {
	if (!ready) {
		console.log("ignoring handleGameList() since we are not ready");
		return;
	}

	/* ===== Setup table rows ===== */
	let foundGames = [];

	$(".game-tr").each(function () {
		let uuid = $(this).data("game-id");

		foundGames.push(uuid);
	});

	for (let i = 0; i < games.length; i++) {
		let game = games[i];

		if (foundGames.includes(game.uuid)) {
			foundGames.remove(game.uuid);
		} else {
			if (debugMode) {
				console.debug("Creating tr for game " + game.uuid);
			}

			let newElement = $("#game_tr_template").clone();
			newElement.removeAttr("id");
			newElement.addClass("game-tr");
			newElement.attr("data-game-id", game.uuid);

			newElement.find(".game-name-content").text(game.name);

			newElement.find(".td-game-custom-settings").text("Loading...");

			if (!game.password_protected) {
				newElement.find(".password-protected").hide();
			}
			newElement.attr("data-password-protected", game.password_protected ? "1" : "0");

			newElement.find(".join-game-button").on("click", function () {
				let uuid = $(this).parent().parent().data("game-id");
				let passwordProtected = $(this).parent().parent().data("password-protected") == 1;

				if (passwordProtected) {
					joinPasswordProtected(uuid);
				} else {
					console.log("Attempting to join game " + uuid);
					joinGame(uuid);
				}

			});

			$("#game_table_rows").prepend(newElement);
		}
	}

	$(".game-tr").each(function () {
		let uuid = $(this).data("game-id");

		if (foundGames.includes(uuid)) {
			$(this).remove();
		}
	});

	/* ===== Update rows ===== */
	for (let i = 0; i < games.length; i++) {
		let game = games[i];

		$(".game-tr").each(function () {
			let uuid = $(this).data("game-id");

			if (game.uuid == uuid) {
				$(this).find(".td-game-player-count").text(game.player_count + " / " + gameConfig.maxPlayersPerGame + " Players");
				$(this).find(".td-game-custom-settings").text(game.custom_settings_string);

				let expansions = "";

				game.decks.forEach((deckName) => {
					let deck = getDeck(deckName);

					if (deck == null) {
						expansions += "null, ";
					} else {
						expansions += deck.displayName + ", ";
					}
				});

				if (expansions.length > 2) {
					expansions = expansions.substring(0, expansions.length - 2)
				}

				$(this).find(".td-game-expansions").text(expansions)
			}
		});
	}
}

function handleVotingStart(data) {
	$("#voting_cards").html("");
	$("#btn_card_czar_confirm").attr("disabled", true);

	cardCzarSelected = null;

	let selectedSets = data.selected_sets;

	selectedSets.forEach(set => {
		if (debugMode) {
			console.debug("drawing set with hash " + set.hash);
			console.debug("Content:");
			console.debug(set.selected);
		}

		let setHtml = $("<div></div>");

		setHtml.attr("data-hash", set.hash);
		setHtml.addClass("played-card-set");

		if (myUUID == activeGame.card_czar) {
			setHtml.addClass("card-czar-can-select");
		}

		set.selected.forEach(card => {
			let cardHtml = $("#result_white_card_template").clone();

			cardHtml.removeAttr("id");
			cardHtml.find(".selected-card-number").remove(); // Remove badge that we dont need here
			cardHtml.find(".card-text-content").html(card.text.replace(/\n/g, "<br>"));
			cardHtml.addClass("played-white-card");

			if (activeGame.settings.showCardPack) {
				cardHtml.attr("title", "This card is from " + card.deck_name);
				cardHtml.find(".expansion-name").text(card.deck_name);
			} else {
				cardHtml.find(".white-card-footer").remove();
			}

			setHtml.append(cardHtml);
		});

		setHtml.on("click", function () {
			if (myUUID != activeGame.card_czar) {
				return; // The player is not the card czar
			}

			$(".card-czar-selected").removeClass("card-czar-selected");
			$(this).addClass("card-czar-selected");
			$("#btn_card_czar_confirm").attr("disabled", false);
			cardCzarSelected = $(this).data("hash");
			if (debugMode) {
				console.debug("Selected " + cardCzarSelected);
			}
		});

		$("#voting_cards").append(setHtml);
	});
}

function handleRoundStart(data) {
	// Clear voting cards
	$("#voting_cards").html("");

	// Reset and prepare for next round
	selectedCards = [];
	$(".selected-white-card").removeClass("selected-white-card");
	updateSelectionNumbers();
	setThrowawayMode(false);
}

/* ===== This gets called when something in the game changes and the game needs to update ===== */
function handleGameState(data) {
	if (!ready) {
		console.log("ignoring handleGameState() since we are not ready");
		return;
	}


	if (data.active_game == null) {
		$("#game_browser").show();
		$("#game").hide();

		activeGame = null;
	} else {
		$("#game").show();
		$("#game_browser").hide();

		activeGame = data.active_game;

		if (activeGame.settings.allowThrowingAwayCards) {
			$("#btn_throwaway_mode").show();
		} else {
			$("#btn_throwaway_mode").hide();
		}

		if (!activeGame.winner_selected) {
			$("#round_winner_text").hide();
		}

		if (activeGame.state == 0) {
			/* ===== Lobby data ===== */
			$("#waiting_lobby").show();
			$("#in_game").hide();

			if (activeGame.host == myUUID) {
				$("#host_options").show();
			} else {
				$("#host_options").hide();
			}

			$("#players_tbody").find(".lobby-player-tr").remove();
			for (let i = 0; i < activeGame.players.length; i++) {
				let player = activeGame.players[i];

				let newElement = $("#lobby_player_template").clone();
				newElement.removeAttr("id");
				newElement.addClass("lobby-player-tr");
				newElement.attr("data-player-id", player.uuid);

				newElement.find(".td-player-name").text(player.username);

				$("#players_tbody").append(newElement);
			}

			let expansions = "";

			activeGame.decks.forEach((deckName) => {
				let deck = getDeck(deckName);

				if (deck == null) {
					expansions += "null, ";
				} else {
					expansions += deck.displayName + ", ";
				}
			});

			if (expansions.length > 2) {
				expansions = expansions.substring(0, expansions.length - 2)
			}

			$("#game_expansions").text(expansions);

			$("#game_custom_settings").text(activeGame.custom_settings_string);
		} else {
			/* ===== In game ===== */

			/* ===== Black card ===== */
			$("#waiting_lobby").hide();
			$("#in_game").show();

			if (activeGame.black_card == null) {
				$("#black_card_pick").text("");
				$("#black_card_text").text("");

				$("#black_card_footer").addClass("hidden");
				$("#black_card_expansion_name").text("");
				$("#black_card").removeAttr("title");
			} else {
				let blackCard = activeGame.black_card;

				$("#black_card_pick").text("pick " + blackCard.pick);
				$("#black_card_text").html(blackCard.text.replace(/\n/g, "<br>"));

				if (activeGame.settings.showCardPack) {
					console.debug("Black card is from " + activeGame.black_card.deck_name);
					$("#black_card_expansion_name").text(activeGame.black_card.deck_name);
					$("#black_card_footer").removeClass("hidden");
					$("#black_card").attr("title", "This card is from " + activeGame.black_card.deck_name);
				} else {
					$("#black_card_expansion_name").text("");
					$("#black_card_footer").addClass("hidden");
					$("#black_card").removeAttr("title");
				}
			}


			/* ===== Player list (ingame version) ===== */
			let foundPlayers = [];
			$(".ingame-player-tr").each(function () {
				foundPlayers.push($(this).data("uuid"));
			});

			activeGame.players.forEach((player) => {
				if (foundPlayers.includes(player.uuid)) {
					$(".ingame-player-tr").each(function () {
						if (player.uuid == $(this).data("uuid")) {
							$(this).find(".td-player-score").text(player.score);
						}
					});
				} else {
					let newElement = $("#ingame_player_template").clone();
					newElement.removeAttr("id");
					newElement.addClass("ingame-player-tr");
					newElement.attr("data-uuid", player.uuid);

					newElement.find(".card-czar").hide();
					newElement.find(".selecting-cards").hide();

					newElement.find(".player-name").text(player.username);
					newElement.find(".td-player-score").text(player.score);

					if (player.uuid == myUUID) {
						newElement.addClass("my-player");
					}

					$("#game_players_tbody").append(newElement);
				}

				foundPlayers.remove(player.uuid);
			});

			foundPlayers.forEach((uuid) => {
				$(".ingame-player-tr").each(function () {
					if ($(this).data("uuid") == uuid) {
						$(this).remove();
					}
				});
			});

			$(".ingame-player-tr").each(function () {
				let uuid = $(this).data("uuid");
				if (uuid == activeGame.card_czar) {
					$(this).find(".card-czar").show();
					$(this).find(".selecting-cards").hide();
				} else {
					$(this).find(".card-czar").hide();
					if (activeGame.players.find(p => p.uuid == uuid).done) {
						// Show because we are the card boi
						$(this).find(".selecting-cards").hide();
					} else {
						if (activeGame.phase == 0) {
							// Show because we are in the selecting phase
							$(this).find(".selecting-cards").show();
						} else {
							// Hide because we are in the voting phase
							$(this).find(".selecting-cards").hide();
						}
					}
				}
			});

			/* ===== Card czar ===== */
			if (activeGame.phase == 1 && myUUID == activeGame.card_czar) {
				$("#card_czar_options").show();
			} else {
				$("#card_czar_options").hide();
			}

			/* ===== Player hand state ===== */
			let isCardCzar = myUUID == activeGame.card_czar;
			let enableHand = true;

			let message = -1; // 1: You are the Card Czar 2: Waiting for other players 3: Wait for the Card Czar to pick the winner

			if (isCardCzar) {
				// Card czar does not have a hand
				message = 1;
				enableHand = false;
			} else {
				// We are not the card czar
				$("#you_are_card_czar").hide();

				if (activeGame.phase == 0) {
					// Picking phase
					if (activeGame.players.find(p => p.uuid == myUUID).done) {
						// We are done
						enableHand = false;
						message = 2;
					}
				} else {
					enableHand = false; // You cant pick cards in the voting phase

					// Voting phase
					if (!isCardCzar) {
						message = 3;
					}
				}
			}

			if (activeGame.winner_selected) {
				// No message because the winner is selected
				$("#btn_card_czar_confirm").attr("disabled", true);
				message = -1;
			}

			$(".player-message").hide();

			switch (message) {
				case 1:
					$("#you_are_card_czar").show();
					break;

				case 2:
					$("#wait_for_other_players").show();
					break;

				case 3:
					$("#wait_for_card_czar").show();
					break;

				default:
					break;
			}

			// enable / disable hand depending on hame state
			if (enableHand) {
				$("#player_hand").removeClass("disabled-content");
				$("#btn_throwaway_mode").attr("disabled", activeGame.throwaway_used);
			} else {
				$("#player_hand").addClass("disabled-content");
				$("#btn_confirm_selection").attr("disabled", true);
				$("#btn_throwaway_mode").attr("disabled", true);
			}

			/* ===== Player hand cards ===== */
			let handCards = [];

			$(".player-hand-card").each(function () {
				handCards.push(b64_to_utf8($(this).data("content")));
			});

			activeGame.hand.forEach((card) => {
				if (!handCards.includes(card.text)) {
					let newHtml = $("#white_card_template").clone();

					newHtml.removeAttr("id");
					newHtml.attr("data-content", utf8_to_b64(card.text));
					newHtml.addClass("player-hand-card");

					newHtml.find(".selected-card-number").hide();
					newHtml.find(".card-text-content").html(card.text.replace(/\n/g, "<br>"));

					if (activeGame.settings.showCardPack) {
						newHtml.attr("title", "This card is from " + card.deck_name);
						newHtml.find(".expansion-name").text(card.deck_name);
					} else {
						newHtml.find(".white-card-footer").remove();
					}

					newHtml.on("click", function () {
						if (throwawayMode) {
							throwAwayCard(b64_to_utf8($(this).data("content")));
							return;
						}

						if ($(this).hasClass("selected-white-card")) {
							$(this).removeClass("selected-white-card");
							selectedCards.remove(b64_to_utf8($(this).data("content")));
							updateSelectionNumbers();
						} else {
							if (activeGame.black_card == null) {
								return;
							}

							if (selectedCards.length >= activeGame.black_card.pick) {
								toastr.warning("Click on the selected cards to unselect them", "You have selected the maximum amount of cards");
								return;
							}

							$(this).addClass("selected-white-card");
							selectedCards.push(b64_to_utf8($(this).data("content")));
							updateSelectionNumbers();
						}
					});

					$("#player_hand").append(newHtml);
				}

				handCards.remove(card.text);
			});


			$(".player-hand-card").each(function () {
				if (handCards.includes(b64_to_utf8($(this).data("content")))) {
					$(this).remove();
				}
			});
		}
	}
}

// also enables / disables the confirm selection button
function updateSelectionNumbers() {
	if (activeGame != null) {
		if (activeGame.black_card != null) {
			let select = activeGame.black_card.pick;

			$("#player_hand").find(".selected-card-number").hide();
			if (select > 1) {
				for (let i = 0; i < selectedCards.length; i++) {
					let b64 = utf8_to_b64(selectedCards[i]);
					$("#player_hand").find(".player-hand-card").each(function () {
						if ($(this).data("content") == b64) {
							$(this).find(".selected-card-number").text(i + 1);
							$(this).find(".selected-card-number").show();
						}
					});
				}
			}

			if (selectedCards.length == select && game.card_czar != myUUID && !activeGame.players.find(p => p.uuid == myUUID).done) {
				$("#btn_confirm_selection").attr("disabled", false);
			} else {
				$("#btn_confirm_selection").attr("disabled", true);
			}
		}
	}
}

/* ----- JQuery ----- */
$(function () {
	$("#game").hide();
	$("#you_are_card_czar").hide();
	$("#btn_confirm_selection").attr("disabled", true);

	$("#btn_createGame").on("click", function () {
		let gameName = $("#tbx_createGameName").val();
		let password = $("#tbx_gamePassword").val();

		if (password.length == 0) {
			password = null;
		}

		if (gameName.length == 0) {
			toastr.error("Please provide a name for the game");
			return;
		}

		if (gameName.length > gameConfig.maxGameNameLength) {
			toastr.error("The name cant be over " + gameConfig.maxGameNameLength + " characters");
			return;
		}

		socket.send("create_game", {
			game_name: gameName,
			password: password
		});
	});

	$(".btn_leaveGame").on("click", function () {
		$.confirm({
			title: 'Confirm!',
			content: 'Do you really want to leave the game?',
			theme: (activeTheme.is_dark ? "dark" : "light"),
			buttons: {
				confirm: function () {
					socket.send("leave_game", {});
				},
				cancel: function () { }
			}
		});
	});

	$("#btn_select_expansions").on("click", function () {
		updateExpansionSelector();
		$("#selectExpansionsModal").modal("show");
	});

	$("#btn_save_expansions").on("click", function () {
		$("#selectExpansionsModal").modal("hide");
		saveExpansions();
	});

	$("#btn_start_game").on("click", function () {
		socket.send("start_game", {});
	});

	$("#btn_confirm_selection").on("click", function () {
		socket.send("select_cards", {
			selected_cards: selectedCards
		});
	});

	$("#btn_card_czar_confirm").on("click", function () {
		if (cardCzarSelected != null) {
			socket.send("card_czar_select_cards", {
				selected: cardCzarSelected
			});
		} else {
			console.log("#btn_card_czar_confirm clicked while cardCzarSelected is null");
		}
	});

	$("#btn_setUsername").on("click", function () {
		let name = $("#tbx_userName").val();

		window.localStorage.setItem("name", name);

		socket.send("set_name", {
			name: name
		});
	});

	$("#btn_custom_settings").on("click", function () {
		showCustomSettingsMenu();
	});

	$("#btn_reset_game_settings").on("click", function () {
		$("#gameSettingsModal").modal("hide");
		resetCustomSettings();
	});

	$("#btn_save_game_settings").on("click", function () {
		$("#gameSettingsModal").modal("hide");
		saveCustomSettings();
	});

	$("#btn_throwaway_mode").on("click", function () {
		setThrowawayMode(!throwawayMode);
	});

	$(".hide-until-loaded").removeClass(".hide-until-loaded");

	setInterval(() => {
		if(activeGame == null) {
			updateGameList();
		}
	}, 2000);
});

function updateGameList() {
	$.getJSON("/api/game_list", function(data) {
		handleGameList(data);
	});
}

/* ----- Expansions ----- */
function useAllExpansions() {
	$(".cbx-expansion-selection").prop("checked", true);
}

function setupExpansions() {
	$("#expansions").text("");
	gameConfig.deckCollections.forEach((deckCollection) => {
		let collectionHtml = $("#deck_collection_template").clone();
		collectionHtml.removeAttr("id");
		collectionHtml.find(".collection-name").text(deckCollection.displayName);
		collectionHtml.find(".collection-description").html(deckCollection.description);
		$("#expansions").append(collectionHtml);

		deckCollection.decks.forEach((deck) => {
			let deckId = "cbx_deck-" + deck.name;

			let title = deck.blackCards.length + " black cards " + deck.whiteCards.length + " white cards";

			let newElement = $("#expanstion_template").clone();
			newElement.removeAttr("id");
			newElement.attr("title", title);
			newElement.find(".form-check-input").attr("id", deckId);
			newElement.find(".form-check-input").addClass("cbx-expansion-selection");
			newElement.find(".form-check-input").attr("data-deck-name", deck.name);
			newElement.find(".form-check-label").attr("for", deckId);
			newElement.find(".form-check-label").text(deck.displayName);

			$("#expansions").append(newElement);
		});
	});

	console.log("All expansions has been loaded");
}

function updateExpansionSelector() {
	if (activeGame == null) {
		$(".cbx-expansion-selection").prop("checked", false);
	} else {
		activeGame.decks.forEach((deck) => {
			$(".cbx-expansion-selection[data-deck-name=\"" + deck + "\"]").prop("checked", true);
		});
	}
}

function saveExpansions() {
	let expansions = {};

	$(".cbx-expansion-selection").each(function () {
		let name = $(this).data("deck-name");

		expansions[name] = $(this).is(':checked');
	});

	socket.send("set_game_expanstions", {
		expansions: expansions
	});
}

/* ----- Custom game settings ----- */
function showCustomSettingsMenu() {
	if (activeGame == null) {
		return;
	}

	let settings = activeGame.settings;

	console.log("Active settings:");
	console.log(activeGame.settings);

	$("#tbx_handSize").val(settings.handSize);
	$("#tbx_timeLimit").val(settings.maxRoundTime);
	$("#tbx_winScore").val(settings.winScore);
	$("#cbx_throwawayCards").attr("checked", settings.allowThrowingAwayCards);
	$("#cbx_showExpansionName").attr("checked", settings.showCardPack);

	$("#gameSettingsModal").modal("show");
}

function saveCustomSettings() {
	let handSize = parseInt($("#tbx_handSize").val());
	let maxRoundTime = parseInt($("#tbx_timeLimit").val());
	let winScore = parseInt($("#tbx_winScore").val());
	let allowThrowingAwayCards = $("#cbx_throwawayCards").is(':checked');
	let showCardPack = $("#cbx_showExpansionName").is(':checked');

	let customSettings = {
		hand_size: handSize,
		win_score: winScore,
		max_round_timer: maxRoundTime,
		allow_throwaway_cards: allowThrowingAwayCards,
		show_card_pack: showCardPack
	}

	console.log("Sending custom settings object");
	console.log(customSettings);

	socket.send("set_game_settings", customSettings);
}

function resetCustomSettings() {
	socket.send("set_game_settings", {
		reset: true
	});
}

function setupGameSettingsLimits() {
	$("#tbx_handSize").attr("min", gameConfig.customSettingsLimit.minHandSize);
	$("#tbx_handSize").attr("max", gameConfig.customSettingsLimit.maxHandSize);

	$("#tbx_timeLimit").attr("min", gameConfig.customSettingsLimit.minRoundTime);
	$("#tbx_timeLimit").attr("max", gameConfig.customSettingsLimit.maxRoundTime);

	$("#tbx_winScore").attr("min", gameConfig.customSettingsLimit.minWinScore);
	$("#tbx_winScore").attr("max", gameConfig.customSettingsLimit.maxWinScore);
	console.log("Custom settings limits set");
}

/* ===== throwaway cards ===== */
function setThrowawayMode(active) {
	if (active === true) {
		throwawayMode = true;
		$("#btn_throwaway_mode").text("Cancel");
		$(".player-hand-card").addClass("throwaway-card-mode");
		toastr.info("Click on the card you want to throw away");
	} else {
		throwawayMode = false;
		$("#btn_throwaway_mode").text("Throw away card");
		$(".throwaway-card-mode").removeClass("throwaway-card-mode");
	}
}

function throwAwayCard(cardName) {
	console.log("Throwing away card " + cardName);
	setThrowawayMode(false);
	$(".selected-white-card").removeClass("selected-white-card");
	selectedCards = [];
	updateSelectionNumbers();

	socket.send("throw_away_card", {
		card: cardName
	});
}