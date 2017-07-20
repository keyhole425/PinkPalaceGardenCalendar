/*
	index.js - Main file for handling database data and models

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

// OUR MODULES
var logger = require('./utils/logger.js');

// MODELS
var Event = require('./models/Event');

/*
	Takes a new event, validates it and then saves it if successful
*/
exports.insertEvent = (newEvent, callback) => {
	//Create our mongoose model
	var eventObject = new Event(newEvent);

	eventObject.save( (err, savedEvent) => {
		if (err) { 
			logger.error('Error saving Event data');
			logger.error(err);
			return callback(true);
		}

		logger.info('Success saving Event data');
		return callback(false);
	});
};