/*
	routes.js - Main Server Routes File
	
	Author: Kyle Combeer (2018)
	Company: Pink Palace
*/
// NPM MODULES
const express = require('express');

// OUR ROUTES
const growRoutes = require('./Grow');

// Create Express Router
const router = express();

const routerVersion = '/api/v1';

// Add Routes
router.use(routerVersion + '/grow', growRoutes);

//Export Routes
module.exports = router;