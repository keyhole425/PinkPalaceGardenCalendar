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
import Events from '../events';

// Setup the localizer by providing the moment (or globalize) Object
// to the correct localizer.

export default class Calendar extends React.Component {
	constructor(props, context) {
		super(props, context);

		this.context = context;
		this.state = {
			events: Events
		};

		BigCalendar.setLocalizer(BigCalendar.momentLocalizer(moment));
		this.handleSelectSlot = this.handleSelectSlot.bind(this);
	}

	handleSelectSlot(slotInfo) {
		alert(slotInfo.start + ' ' + slotInfo.end);
	}

	render() {
		return (
			<div>
				<BigCalendar 
					events={ this.state.events } 
					startAccessor='start' 
					endAccessor='end' 
					selectable={ true } 
					popup={ true }
					onSelectEvent={ (event) => alert(event.title) }
					onSelectSlot={ this.handleSelectSlot }/>
			</div>
		);
	}
}
