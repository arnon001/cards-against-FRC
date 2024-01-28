$(function() {
	setInterval(function() {
		let handPos = $("#player_hand").position();
		let width = $("#player_hand").width();
		let height = $("#player_hand").height();

		$("#hand_message").css({top: handPos.top + "px", left: handPos.left + "px", width: width+"px", height: height + "px"});
	}, 250);
});