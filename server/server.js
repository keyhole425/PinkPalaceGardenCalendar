/*
	server.js - Main file for Pink Palace Garden Calendar Back-End Server

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/
// NODE MODULES
const path = require('path');

// NPM MODULES
const express = require('express');
const bodyParser = require('body-parser');

// OUR MODULES
const logger = require('./utils/logger');
const mongoserver = require('./db');
const env = require('../env');

// OUR ROUTE
const apiRoutes = require('./routes/routes');

// CURRENT ROUTE VERSION
const routeVersion = 'v1';

//TODO - Learn how to set this properly
//Set node dev or prod env
process.env.NODE_ENV = env.NODE_ENV;

// APP SETUP
const server = express();

//APP CONFIGURATION
server.use(bodyParser.json({limit: '5mb'})); //allows us to jsonify things
server.use(bodyParser.urlencoded({limit: '5mb', extended: true})); //allows us to access the body of POST/PUT + other requests
server.use('/', express.static(path.resolve(__dirname, '../build')));

logger.info(`App will serve static content from ${path.resolve(__dirname, '../build')}`);

// SET MIDDLEWARE
server.use('*', (req, res, next) => {
	logger.info(`Got request from ${req.ip} looking for ${req.path} using ${req.method}`);
	next();
});

// SET ROUTES
server.use('/', apiRoutes);

/*
	This lets React start up
	HOMEPAGE - For Prototype the homepage is an upload file page that returns an tuned up song
*/
server.get('*', (req, res) => {
	res.sendFile(path.resolve(__dirname, '../build/index.html'));
});

// ERROR MIDDLEWARE
server.use( (err, req, res, next) => {
	logger.error('Error HTTP Status Code:', err.httpStatusCode);
	logger.error(err);

	return res.status(err.httpStatusCode).json({
		'error': err.message
	});
});

module.exports = server;