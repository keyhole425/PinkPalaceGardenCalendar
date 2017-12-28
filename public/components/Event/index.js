/*
	Event/index.js - Event file for Pink Palace Calendar View

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

// NPM MODULES
import React from 'react';

// REACT MODULES
import { Modal, ModalHeader, ModalBody } from 'elemental';

//Elemental CSS
import '../../../node_modules/elemental/less/elemental.less';

export default class Event extends React.Component {
	constructor(props, context) {
		super(props, context);

		console.log('Creating event component');

		this.context = context;
		this.state = {
			modalOpen: false
		};
	}

	render() {
		return (
			<div>
				<Modal isOpen={ this.props.initialOpen } onCancel={ this.props.toggleEventModal }>
					<ModalHeader text={ this.props.eventType } showCloseButton onClose={ this.props.toggleEventModal } />
					<ModalBody> FUCK YA CUNNO </ModalBody>
				</Modal>
			</div>
		);
	}
}