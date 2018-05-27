/*
	db.js - Main Database file for Pink Palace Garden Calendar Back-End Server

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

// NPM MODULES
const mongoose = require('mongoose');

// OUR MODULES
const logger = require('./utils/logger');

// MONGODB DEV URL
const url = 'mongodb://localhost:27017/ppa'; //Prototype database in db server

mongoose.Promise = global.Promise;
mongoose.connect(url, { useMongoClient: true });

let db = mongoose.connection;

db.once('open', () => {
	logger.info('Connected to MongoDB database');
});

db.on('error', (err) => {
	logger.error('Error connecting to the database, did you forget to turn it on?');
});