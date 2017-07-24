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
import '../../../node_modules/elemental/less/elemental.less'
import Events from '../events';
import { Modal, ModalHeader, ModalBody } from 'elemental';


// Setup the localizer by providing the moment (or globalize) Object
// to the correct localizer.

export default class Calendar extends React.Component {
	constructor(props, context) {
		super(props, context);

		this.context = context;
		this.state = {
			events: Events,
			modalOpen: false
		};

		BigCalendar.setLocalizer(BigCalendar.momentLocalizer(moment));
	}

	openNewEventModal = (slotInfo) => {
		console.log('New event modal show');

		this.setState({
			modalOpen: true
		});
	}

	cancelNewEventModal = () => {
		this.setState({
			modalOpen: false
		});
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
					onSelectEvent= { (event) => alert(event.title) }
					onSelectSlot= { this.openNewEventModal } />
				<Modal isOpen={ this.state.modalOpen } onCancel={ this.cancelNewEventModal }>
					<ModalHeader text="Nice header bro" />
					<ModalBody> FUCK YA CUNNO </ModalBody>
				</Modal>	
			</div>
		);
	}
}