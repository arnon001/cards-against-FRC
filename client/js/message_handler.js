function handleMessage(data) {
	let message = data.message;
	switch (data.type) {
		case 0:
			toastr.info(message);
			break;

		case 1:
			toastr.success(message);
			break;

		case 2:
			toastr.warning(message);
			break;

		case 3:
			toastr.error(message);
			break;

		default:
			console.error("Invalid message type: " + data.type);
			break;
	}
}