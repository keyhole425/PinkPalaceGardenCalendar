/*
	Event/index.js - Routes file for Events
	
	Author: Kyle Combeer (2018)
	Company: Pink Palace
*/
// NPM MODULES
const express = require('express');

// OUR MODULES
const logger = require('../../utils/logger');

// Create Express Router
const router = express();

// Create Routes
router.route('/')
	.get( (req, res, next) => {
		return res.status(200).send('GET endpoint for events not set up, did you mean to POST?');
	})
	.post( (req, res, next) => {
		const 	plant = req.body.plant,
				age = req.body.age,
				amount = req.body.plantAmount;
		return res.status(201).send('Received POST request, currently stubbed');
	});

// Export Routes
module.exports = router;