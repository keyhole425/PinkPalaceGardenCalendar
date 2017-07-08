/*
	webpack.config.js - Webpack Configuration File for Pink Palace Gardening

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/


// Node Modules
var path = require('path');


// NPM Modules
var HtmlWebpackPlugin = require('html-webpack-plugin');

/*
	Our configuration for the HTML plugin
*/
var HtmlWebpackPluginConfig = new HtmlWebpackPlugin({
	template: path.resolve(__dirname, 'public/index.html'),
	filename: 'index.html',
	inject: 'body'
});

/*
	Our Webpack Configuration File
*/
module.exports = {
	entry: path.resolve(__dirname, 'public','client.js'),
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/, 
				exclude: [
					path.resolve(__dirname, 'node_modules'), 
					path.resolve(__dirname, 'server')
				], 
				loader: 'babel-loader',
				options: {
					presets: ['es2015', 'react']
				}
			},
			{
				test: /\.css$/,
				exclude: [
					path.resolve(__dirname, 'server')
				],
				loader: 'style-loader!css-loader'
			}
		]
	},
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'build')
	},
	plugins: [
		HtmlWebpackPluginConfig //Bundles scripts into our initial html file
	],
	target: "web"
}