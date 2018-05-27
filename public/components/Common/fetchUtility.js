/*
	Common/fetchUtility.js - Utility file for fetch functions

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/


export default class fetchUtility {
	constructor() {}
	
	postToUrl = (url, body) => {
		return new Promise( async (fulfill, reject) => {
			if (!url || typeof url === 'undefined') {
				return reject('url should be a real value');
			}
			else if (!body || typeof body === 'undefined') {
				return reject('Body should be a real value');
			}

			// Attach headers to POST
			let headers = new Headers();
			headers.set('Content-Type', 'application/json');
				
			// Set options for fetch call
			let options = {
				method: 'POST',
				body: JSON.stringify(body),
				headers: headers
			};

			try {
				// Make our call to the URL with our options now
				let response = await fetch(url, options);
				
				return fulfill(response);
				
			}
			catch(err) {
				console.error('Got an error response', err);
				return reject(err);
			}
		});
	}
}