/*
	Common/fetchUtility.js - Utility file for fetch functions

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/


export default class fetchUtility {
	constructor() {}
	
	postToUrl = (url, body, options) => {
		return new Promise( (fulfill, reject) => {
			// Set options for 
			let postOptions = (options) ? options : {};
			let bodyContents = (body) ? JSON.stringify(body) : '';
			let formData = new FormData();

			//Set our static options
			postOptions.method = 'post';
			postOptions.headers = {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
			};

			// Add our body data in
			postOptions.body = bodyContents;

			// Make our call to the URL with our options now
			fetch(url, postOptions)
			.then( (response) => {
				// Got a response...
				if (response.status === 201) {
					// Positive response
					console.log('Got a good response');
					return fulfill();
				}

				// Bad response
				console.log('Got a bad response');
				return reject();
			})
			.catch( (err) => {
				// Error during fetch call
				console.error('Got an error response', err);
				return reject(err);
			});
		});
	}
}