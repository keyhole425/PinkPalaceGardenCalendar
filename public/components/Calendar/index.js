/*
	Calendar/index.js - Main file for Pink Palace Calendar View

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

import React from 'react';
import BigCalendar from 'react-big-calendar';
import moment from 'moment';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../main.css';
import events from '../events';

console.log('events');
console.log(events);

// Setup the localizer by providing the moment (or globalize) Object
// to the correct localizer.
BigCalendar.momentLocalizer(moment); // or globalizeLocalizer

export default class Calendar extends React.Component {
	render() {
		return (
			<div>
				<BigCalendar 
					events={events} 
					startAccessor='start' 
					endAccessor='end' 
					selectable={true} 
					popup={true}
					onSelectEvent={(event) => alert(event.title)}/>
			</div>
		);
	}
}
