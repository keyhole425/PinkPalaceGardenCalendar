/*
	Calendar/index.js - Main file for Pink Palace Calendar View

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

// NPM MODULES
import React from 'react';
import BigCalendar from 'react-big-calendar';
import moment from 'moment';

// REACT COMPONENT
import { Modal, ModalHeader, ModalBody } from 'elemental';
import Event from '../Event/index';

// NPM MODULE CSS
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../../node_modules/elemental/less/elemental.less'

// STATIC EVENTS
import Events from '../events';


// Setup the localizer by providing the moment (or globalize) Object
// to the correct localizer.
export default class Calendar extends React.Component {
	constructor(props, context) {
		super(props, context);

		this.context = context;
		this.state = {
			events: Events,
			modalOpen: false,
			eventType: ''
		};

		BigCalendar.setLocalizer(BigCalendar.momentLocalizer(moment));
	}

	openNewEventModal = (slotInfo) => {
		console.log('New event modal show ', slotInfo);

		this.setState({
			modalOpen: true,
			eventType: 'new'
		});
	}

	openEditEventModal = (slotInfo) => {
		console.log('Edit event modal show ', slotInfo);

		this.setState({
			modalOpen: true,
			eventType: 'edit'
		});
	}

	toggleEventModal = () => {
		this.setState({
			modalOpen: !this.state.modalOpen
		});
	}

	/*
		
	*/
	renderEventPopup = () => {
		console.log('event popup render: ', this.state.modalOpen);

		return (
			<div>
				<Event initialOpen={ this.state.modalOpen }
				toggleEventModal={ this.toggleEventModal }
				eventType={ this.state.eventType } />
			</div>
		);
	}

	render() {
		let eventPopup = this.renderEventPopup();

		return (
			<div>
				<BigCalendar 
					events={ this.state.events } 
					startAccessor='start' 
					endAccessor='end' 
					selectable={ true } 
					popup={ true }
					onSelectEvent={ this.openEditEventModal }
					onSelectSlot={ this.openNewEventModal } />
				{ eventPopup }
			</div>
		);
	}
}