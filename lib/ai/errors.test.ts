/**
 * Error messages a gardener has to read.
 *
 * The SDK puts a JSON body in `message`, which is no help to somebody standing
 * in a garden wondering why nothing happened.
 */
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { describeError } from './client';

function apiError(status: number, message: string) {
	return new Anthropic.APIError(status, { message }, message, new Headers());
}

describe('what figgy says when Claude will not answer', () => {
	it('names an empty account and says where to fix it', () => {
		const raw =
			'400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}';
		const said = describeError(apiError(400, raw));
		expect(said).toContain('no credit');
		expect(said).toContain('console.anthropic.com');
		// And not a wall of JSON.
		expect(said).not.toContain('{');
	});

	it('points a refused key at the file it lives in', () => {
		const said = describeError(
			new Anthropic.AuthenticationError(401, {}, 'nope', new Headers()),
		);
		expect(said).toContain('ops/.env');
	});

	it('suggests waiting when rate limited', () => {
		const said = describeError(
			new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()),
		);
		expect(said).toContain('Try again');
	});

	it('treats an outage as their problem, not yours', () => {
		expect(describeError(apiError(529, 'overloaded'))).toContain('their end'.replace('their', 'its'));
	});

	it('pulls the sentence out of any other error body', () => {
		const raw = '400 {"error":{"message":"max_tokens must be positive"}}';
		expect(describeError(apiError(400, raw))).toContain(
			'max_tokens must be positive',
		);
	});

	it('passes an ordinary error through unchanged', () => {
		expect(describeError(new Error('the disk is full'))).toBe('the disk is full');
	});
});
