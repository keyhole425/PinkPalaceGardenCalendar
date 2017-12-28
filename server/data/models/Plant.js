/*
	Plant.js - Mongoose model for Plant objects

	Author: Kyle Combeer (2017)
	Company: Virtual Ark
*/

var mongoose = require('mongoose');

//Event objects
var plantSchema = mongoose.Schema({
	description: String,
	feeding: String,
	flowering: String,
	fruiting: Boolean,
	location: String,
	name: String,
	pruning: String,
	schedule: [{
		title: String,
		summary: String,
		start: Date,
		end: Date,
		completed: Boolean,
		plantid: String
	}],
	scientific_name: String,
	seedling: String
});

module.exports = mongoose.model('Plant', plantSchema);