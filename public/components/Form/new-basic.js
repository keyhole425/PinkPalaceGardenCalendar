/*
	Form/new-basic.js - Basic form for entering a new plant event

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
			ageUnit: '',
			position: 'Outdoor',
			light: 'FullSun'
		};
	}

	/* 
		Method used to send data to server
		TODO - Move to EVENT index.js
	*/
	startPlantCalendar = () => {

	}

	/*
		Handles text input changes to make React the source of truth
	*/
	handleChange = (event) => {
		// If receiving value for age field...
		if (event.target.name === 'age' && event.target.value.length > 0) {
			console.log('In the age field');
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

		console.log('Submitted Content For POST...');

		if (!this.state.plant) {
			// No plant selected, this is required
			this.setState({
				inputError: 'Please Select A Plant.'
			});
			return;
		}
		else if (!this.state.age) {
			this.setState({
				inputError: 'Please Select An Age'
			});
			return;
		}

		// Check all values are valid THEN
		// Fire off new event to server to save values THEN
		// Respond with success or failure
		console.log('Have values to submit to form.');
		console.log('Plant.', this.state.plant);
		console.log('Age.', this.state.age);
		console.log('Age Unit.', this.state.ageUnit);
		console.log('Position.', this.state.position);
		console.log('Light.', this.state.light);

		// Set up our body
		let bodyContents = {
			plant: this.state.plant,
			age: this.state.age,
			ageUnit: this.state.ageUnit,
			position: this.state.position,
			light: this.state.light
		};

		// Make a POST call
		newFetch.postToUrl('http://localhost:3050/api/v1/event', bodyContents, null)
		.then( () => {
			console.log('Returned to Event Form with Success');
		})
		.catch( (err) => {
			console.log('Returned to Event Form with Error', err);
		});
	}

	render() {
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
						<input type='text' name='age' value={ this.state.age } onChange={ this.handleChange } />
						<select name='ageUnit' value={ this.state.ageUnit } onChange={ this.handleChange }>
							<option value='Days'>Days</option>
							<option value='Weeks'>Weeks</option>
							<option value='Months'>Months</option>
							<option value='Years'>Years</option>
						</select>
					</div>
					<label>
						Position:
					</label>
					<select className='single' name='position' value={ this.state.position } onChange={ this.handleChange }>
						<option value='Outdoor'>Outdoor</option>
						<option value='Indoor'>Indoor</option>
					</select>
					<label>
						Light:
					</label>
					<select className='single' name='light' value={ this.state.light } onChange={ this.handleChange }>
						<option value='FullSun'>Full Sun</option>
						<option value='FullShelter'>Full Shelter</option>
						<option value='Filtered'>Filtered</option>
						<option value='PartialShade'>Partial Shade</option>
					</select>
					<input type='submit' value='Submit' />
				</form>
			</div>
		);
	}
}