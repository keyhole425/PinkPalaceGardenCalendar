/*
	Event.js - Mongoose model for Event objects

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
	creator: {
		id: String,
		name: String
	},
	type: String
});

module.exports = mongoose.model('Event', eventSchema);