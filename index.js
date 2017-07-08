'use strict';

var server = require('./server/server');

//Run Server!
var virtualVoicesApp = server.listen(3050, function () {
	console.log('Listening on port ' + virtualVoicesApp.address().port);
});