/*
	Calendar/index.js - Main file for Pink Palace Calendar View

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

import React from 'react';
import BigCalendar from 'react-big-calendar';
import moment from 'moment';

import 'react-big-calendar/lib/css/react-big-calendar.css'

// Setup the localizer by providing the moment (or globalize) Object
// to the correct localizer.
BigCalendar.momentLocalizer(moment); // or globalizeLocalizer

export default class Calendar extends React.Component {
	render() {
		return (
			<div>
				<BigCalendar events={[]} startAccessor='startDate' endAccessor='endDate'/>
			</div>
		);
	}
}
