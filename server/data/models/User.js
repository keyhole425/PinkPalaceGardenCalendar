/*
	User.js - Mongoose model for User objects

	Author: Kyle Combeer (2017)
	Company: Virtual Ark
*/

var mongoose = require('mongoose');

//Event objects
var userSchema = mongoose.Schema({
	username: String, // Username of user
	password: String // Password of user
});

module.exports = mongoose.model('User', userSchema);