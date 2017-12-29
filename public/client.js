/*
	client.js - Main Entry Point for the React client-side app

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

import App from './components/app.js';
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom'

if (typeof window !== 'undefined') {
	ReactDOM.render((
		<BrowserRouter>
			<App />
		</BrowserRouter>
	), document.getElementById('root'));
}