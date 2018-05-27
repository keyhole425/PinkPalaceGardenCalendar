/*
	Grow.js - Mongoose model for Grow objects

	Author: Kyle Combeer (2018)
	Company: Virtual Ark
*/

const mongoose = require('mongoose');

//Event Object Schema
const growSchema = mongoose.Schema({
	title: String, // Name for the grow
	age: Number, // Age of the plants in the grow
	number_of_plants: Number, // Number of plants in the grow
	start_date: Date // Date this grow was started
});

module.exports = mongoose.model('Grow', growSchema);