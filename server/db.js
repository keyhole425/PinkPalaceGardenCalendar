/*
	db.js - Main Database file for Pink Palace Garden Calendar Back-End Server

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

//NPM MODULES
var mongoose = require('mongoose');

//OUR MODULES
var logger = require('./utils/logger');

//MONGODB DEV URL
const url = 'mongodb://localhost:27017/pinkpalace'; //Prototype database in db server

mongoose.connect(url, { useMongoClient: true });

var db = mongoose.connection;

db.once('open', () => {
	logger.info('Connected to MongoDB database');
});

db.on('error', (err) => {
	logger.error('Error connecting to the database, did you forget to turn it on?');
});