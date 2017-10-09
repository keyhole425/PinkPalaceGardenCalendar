'use strict';

const server = require('./server/server');

//Run Server!
const virtualVoicesApp = server.listen(3050, function () {
	console.log('Listening on port ' + virtualVoicesApp.address().port);
});