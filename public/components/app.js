/*
	app.js - Root React Component

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

import React from 'react';
import Calendar from './Calendar';

// Import CSS
import '../main.css';

export default class App extends React.Component {
	render() {
		return (
			<div>
				<p> Hello Pink Palace! </p>
				<Calendar />
			</div>
		);
	}
}

/*
	Order of elements
	- Header
	- Calendar
	- Action Bar
	- 
*/