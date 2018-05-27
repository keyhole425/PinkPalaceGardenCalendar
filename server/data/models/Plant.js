/*
	Plant.js - Mongoose model for Plant objects

	Author: Kyle Combeer (2017)
	Company: Virtual Ark
*/

const mongoose = require('mongoose');

//Event objects
const plantSchema = mongoose.Schema({
	name: String, // Regular plant name
	scientific_name: String, // Scientific plant name
});

module.exports = mongoose.model('Plant', plantSchema);