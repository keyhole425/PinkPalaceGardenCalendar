/*
	routes.js - Main Server Routes File
	
	Author: Kyle Combeer (2018)
	Company: Pink Palace
*/
// NPM MODULES
const express = require('express');

// OUR ROUTES
const eventRoutes = require('./Event');

// Create Express Router
const router = express();

const routerVersion = '/api/v1';

// Add Routes
router.use(routerVersion + '/event', eventRoutes);

//Export Routes
module.exports = router;