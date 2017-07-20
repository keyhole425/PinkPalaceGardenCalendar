/*
	Events.js - Mongoose model for Events objects

	Author: Kyle Combeer (2017)
	Company: Virtual Ark
*/

var mongoose = require('mongoose');

//Event objects
var eventSchema = mongoose.Schema({
	title: String,
	start: Date,
	end: Date,
	completed: Boolean,
	plantid: String,
	summary: String,
	owner: {
		id: String,
		name: String
	}
});

module.exports = mongoose.model('Event', eventSchema);