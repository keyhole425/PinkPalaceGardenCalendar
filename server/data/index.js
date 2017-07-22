/*
	index.js - Main file for handling database data and models

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

// OUR MODULES
var logger = require('./utils/logger.js');

// MODELS
var Event = require('./models/Event');
var User = require('./models/User');
var Plant = require('./models/Plant');

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

/*
	Takes a new user, validates it and then saves it if successful
*/
exports.insertUser = (newUser, callback) => {
	//Create our mongoose model
	var userObject = new User(newUser);

	userObject.save( (err, savedUser) => {
		if (err) {
			logger.error('Error saving User data');
			logger.error(err);
			return callback(true);
		}

		logger.info('Success saving User data');
		return callback(false);
	});
};

/*
	Takes a new plant, validates it and then saves it if successful
*/
exports.insertPlant = (newPlant, callback) => {
	//Create our mongoose model
	var plantObject = new Plant(newPlant);

	plantObject.save( (err, savedPlant) => {
		if (err) {
			logger.error('Error saving Plant data');
			logger.error(err);
			return callback(true);
		}

		logger.info('Success saving Plant data');
		return callback(false);
	});
};