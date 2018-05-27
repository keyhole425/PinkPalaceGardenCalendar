/*
	Form/new-basic.js - Basic form for entering a new plant grow

	Author: Kyle Combeer 2017
	Company: Pink Palace
*/

// NPM MODULES
import React from 'react';

// OUR MODULES
import fetchUtility from '../Common/fetchUtility';

let newFetch = new fetchUtility();

export default class NewBasicForm extends React.Component {
	constructor(props, context) {
		super(props, context);

		this.context = context;
		this.state = {
			plant: '',
			age: '',
			plantAmount: '',
			created: false // Has event been created yet?
		};
	}

	/*
		Handles text input changes to make React the source of truth
	*/
	handleChange = (event) => {
		// If receiving value for age field...
		if ((event.target.name === 'age' || event.target.name === 'plantAmount') && event.target.value.length > 0) {
			console.log('In the age/plantAmt field');
			console.log('Is nan?', isNaN(event.target.value));

			// Reject if not a number
			if (isNaN(event.target.value)) {
				return;
			}

			return this.setState({
				[event.target.name]: Number.parseInt(event.target.value)
			});
		}

		// If passes all criteria, update value
		this.setState({
			[event.target.name]: event.target.value
		});
	}

	/*
		Handles the clicking of the submit button
	*/
	handleSubmit = (event) => {
		// Prevent default form submit behaviour
		event.preventDefault();

		console.log('Submitting Content For POST...');

		if (!this.state.plant) {
			// No plant selected, this is required
			this.setState({
				inputError: 'Please Input A Plant.'
			});
			return;
		}
		else if (!this.state.age) {
			this.setState({
				inputError: 'Please Input An Age'
			});
			return;
		}
		else if (this.state.plantAmount === -1) {
			this.setState({
				inputError: 'Please Input An Amount Of Plants'
			});
			return;
		}

		// Set up our body
		let bodyContents = {
			plant: this.state.plant,
			age: this.state.age,
			plantAmount: this.state.plantAmount,
			startDate: this.props.slotDetails.start
		};

		// Make a POST call
		newFetch.postToUrl('http://localhost:3050/api/v1/grow', bodyContents, null)
		.then( (response) => {
			console.log('Returned to Event Form with Response status:', response.status);

			// If item was created successfully...
			if (response.status === 201) {
				this.setState({
					created: true
				});
			}
		})
		.catch( (err) => {
			console.log('Returned to Event Form with Error', err);
		});
	}

	render() {
		if (this.state.created) {
			return (
				<div>
					Successfully Created A New Grow.
				</div>
			);
		}
		else {
			return (
				<div>
					<form className='form' onSubmit={ this.handleSubmit }>
						<label>
							Plant:
						</label>
						<input type='text' name='plant' value={ this.state.plant } onChange={ this.handleChange } />
						<div className='age-field'>	
							<label>
								Age:
							</label>
							<input type='text' name='age' value={ this.state.age } onChange={ this.handleChange } /> Days
						</div>
						<div>
							<label>
								Number of Plants: 
							</label>
							<input type='text' name='plantAmount' value={ this.state.plantAmount } onChange={ this.handleChange } />
						</div>
						<input type='submit' value='Submit' />
					</form>
				</div>
			);
		}
	}
}