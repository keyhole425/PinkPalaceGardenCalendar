/*
	Users.js - Mongoose model for User objects

	Author: Kyle Combeer (2017)
	Company: Virtual Ark
*/

var mongoose = require('mongoose');

//Event objects
var userSchema = mongoose.Schema({
	username: String,
	password: String,
	events: [{
		id: String, 
		title: String
	}],
	plants: [{
		id: String,
		name: String
	}],
	notifications: Boolean
});

module.exports = mongoose.model('User', userSchema);