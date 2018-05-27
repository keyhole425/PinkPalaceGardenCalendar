/*
	Event/index.js - Event Component for Pink Palace Calendar View

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

// NPM MODULES
import React from 'react';
import Moment from 'moment';

// REACT MODULES
import { Modal, ModalBody, ModalHeader } from 'elemental';
import NewBasicForm from '../Form/new-basic';

// Elemental CSS
import '../../../node_modules/elemental/less/elemental.less';

export default class Event extends React.Component {
	// Construct Object
	constructor(props, context) {
		super(props, context);

		this.context = context;
		this.state = {
			modalOpen: false
		};
	}

	componentWillReceiveProps(props) {
		console.log('Event received new props:', props);
	}

	render() {
		let headerText = '';

		// Set the header text of the event popping up in the calendar
		if (this.props.eventType === 'new') {
			headerText = 'New Grow Starting ' + Moment(this.props.slotDetails.start).format('DD/MM/YYYY');
		}

		return (
			<div>
				<Modal isOpen={ this.props.initialOpen } onCancel={ this.props.toggleEventModal }>
					<ModalHeader text={ headerText } showCloseButton onClose={ this.props.toggleEventModal } />
					<ModalBody>
						<NewBasicForm slotDetails={ this.props.slotDetails } eventType={ this.props.eventType }/>
					</ModalBody>
				</Modal>
			</div>
		);
	}
}