var activeTheme = {};

const DEFAULT_THEME = "darkly";

$(function () {
	$(".select-theme-button").on("click", function () {
		console.log("Showing theme selector");
		$("#selectThemeModal").modal("show");
	});

	themes.forEach(theme => {
		$("#theme-selector").append(new Option(theme.display_name, theme.name));
	});

	$("#theme-selector").on("change", function () {
		let theme = $(this).find(":selected").val();

		console.log("Changing theme to " + theme);

		applyThemeByName(theme);
	})

	let theme = localStorage.getItem('cah_theme');
	if (theme != null) {
		$("#theme-selector").val(theme);
		applyThemeByName(theme);
	} else {
		applyThemeByName(DEFAULT_THEME);
	}

	console.debug("Theme manager loaded");
});

function applyThemeByName(name) {
	let themeData = null;
	themes.forEach(t => {
		if (t.name == name) {
			themeData = t;
		}
	});

	if (themeData != null) {
		applyTheme(themeData);
	}
}

function applyTheme(theme) {
	$("#css_theme").remove();
	$("#css_theme_fix").remove();

	if (theme.css != undefined) {
		let cssTag = $("<link>");
		cssTag.attr("rel", "stylesheet");
		cssTag.attr("href", "/css/themes/" + theme.css);
		cssTag.attr("id", "css_theme");
		$("head").append(cssTag);
	}

	if (theme.css_fix != undefined) {
		let cssTag = $("<link>");
		cssTag.attr("rel", "stylesheet");
		cssTag.attr("href", "/css/themes/" + theme.css_fix);
		cssTag.attr("id", "css_theme_fix");
		$("head").append(cssTag);
	}

	activeTheme = theme;

	localStorage.setItem("cah_theme", theme.name);
}
