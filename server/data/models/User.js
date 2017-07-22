/*
	User.js - Mongoose model for User objects

	Author: Kyle Combeer (2017)
	Company: Virtual Ark
*/

var mongoose = require('mongoose');

//Event objects
var userSchema = mongoose.Schema({
	events: [{
		id: String, 
		title: String
	}],
	notifications: Boolean,
	password: String,
	plants: [{
		id: String,
		name: String
	}],
	username: String
});

module.exports = mongoose.model('User', userSchema);