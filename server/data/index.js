/*
	index.js - Main file for handling database data and models

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

// OUR MODULES
const logger = require('../utils/logger');

// MODELS
const Grow = require('./models/Grow');
const User = require('./models/User');
const Plant = require('./models/Plant');

/*
	Takes a new grow, validates it and then saves it if successful
*/
exports.insertGrow = (newGrow) => {
	return new Promise( (fulfill, reject) => {
		//Create our mongoose model
		let growObject = new Grow(newGrow);

		// Save this new object to db after validation
		growObject.save( (err) => {
			if (err) { 
				logger.error('Error saving Grow data', err);
				return reject(err);
			}

			logger.info('Success saving Grow data');
			return fulfill();
		});
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