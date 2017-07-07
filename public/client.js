/*
	client.js - Main Entry Point for the React client-side app

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from './components/app.js';
import ReactDOM from 'react-dom';

if (typeof window !== 'undefined') {
	ReactDOM.render((
		<BrowserRouter>
			<div>
				<App />
			</div>
		</BrowserRouter>
	), document.getElementById('root'));
}