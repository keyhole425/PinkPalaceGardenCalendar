/*
	server.js - Main file for Pink Palace Garden Calendar Back-End Server

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/
//NODE MODULES
var path = require('path');

//NPM MODULES
import express from 'express';
import bodyParser from 'body-parser';

//OUR MODULES
var logger = require(__dirname + '/utils/logger');
var mongoserver = require('./db');
var env = require('./env');

//TODO - Learn how to set this properly
//Set node dev or prod env
process.env.NODE_ENV = env.NODE_ENV;

//APP SETUP
var server = express();

//APP CONFIGURATION
server.use(bodyParser.json({limit: '5mb'})); //allows us to jsonify things
server.use(bodyParser.urlencoded({limit: '5mb', extended: true})); //allows us to access the body of POST/PUT + other requests
server.use('/', express.static(path.resolve(__dirname, '../build')));

console.log('App will serve static content from ' + path.resolve(__dirname, '../build'));

//ROUTES
/*
	BELOW ARE API ROUTES, MAKE AS OWN FILE
*/

/*
	This lets React start up
	HOMEPAGE - For Prototype the homepage is an upload file page that returns an tuned up song
*/
server.get('*', (req, res) => {
	res.sendFile(path.resolve(__dirname, '../build/index.html'));
});

module.exports = server;