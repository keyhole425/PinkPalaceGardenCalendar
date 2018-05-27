/*
	Grow/index.js - Routes file for Grows
	
	Author: Kyle Combeer (2018)
	Company: Pink Palace
*/
// NPM MODULES
const express = require('express');

// OUR MODULES
const logger = require('../../utils/logger');
const db = require('../../data');

// Create Express Router
const router = express();

let error;

// Create Routes
router.route('/')
	.get( (req, res, next) => {
		return res.status(200).send('GET endpoint for events not set up, did you mean to POST?');
	})
	.post( async (req, res, next) => {
		logger.info('Req body:', req.body);

		const 	plant = req.body.plant,
				age = req.body.age,
				amount = req.body.plantAmount,
				startDate = req.body.startDate;

		if (!plant || typeof plant === 'undefined') {
			error = new Error('Plant is required');
			error.httpStatusCode = 400;
			return next(error);
		}
		else if (!age || typeof age === 'undefined') {
			error = new Error('Age is required');
			error.httpStatusCode = 400;
			return next(error);
		}
		else if (!amount || typeof amount === 'undefined') {
			error = new Error('Amount of Plants is required');
			error.httpStatusCode = 400;
			return next(error);
		}

		// Create our expected grow object
		let growObject = {
			title: plant,
			age: age,
			number_of_plants: amount,
			start_date: startDate
		};

		// Insert Grow object into MongoDB
		let savedObject = await db.insertGrow(growObject);

		return res.status(201).json(savedObject);
	});

// Export Routes
module.exports = router;