import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { open, seal } from './secretbox';

const original = { ...process.env };
afterEach(() => {
	process.env = { ...original };
});

describe('a sealed secret', () => {
	it('opens again with the same key and context', () => {
		const sealed = seal('sk-ant-secret', 'household:1');
		expect(sealed).not.toContain('sk-ant-secret');
		expect(open(sealed, 'household:1')).toBe('sk-ant-secret');
	});

	it('comes out different every time, even for the same secret', () => {
		expect(seal('same', 'household:1')).not.toBe(seal('same', 'household:1'));
	});

	it('will not open for another household', () => {
		const sealed = seal('sk-ant-secret', 'household:1');
		expect(() => open(sealed, 'household:2')).toThrow();
	});

	it('will not open if a byte has been changed', () => {
		const sealed = seal('sk-ant-secret', 'household:1');
		const parts = sealed.split('.');
		const ct = Buffer.from(parts[3] ?? '', 'base64url');
		ct[0] = (ct[0] ?? 0) ^ 1;
		parts[3] = ct.toString('base64url');
		expect(() => open(parts.join('.'), 'household:1')).toThrow();
	});

	it('will not open with a different key', () => {
		process.env.FIGGY_ENCRYPTION_KEY = randomBytes(32).toString('base64');
		const sealed = seal('sk-ant-secret', 'household:1');
		process.env.FIGGY_ENCRYPTION_KEY = randomBytes(32).toString('base64');
		expect(() => open(sealed, 'household:1')).toThrow();
	});

	it('still opens with the previous key while the key is being changed', () => {
		const old = randomBytes(32).toString('base64');
		process.env.FIGGY_ENCRYPTION_KEY = old;
		const sealed = seal('sk-ant-secret', 'household:1');
		process.env.FIGGY_ENCRYPTION_KEY = randomBytes(32).toString('base64');
		process.env.FIGGY_ENCRYPTION_KEY_PREVIOUS = old;
		expect(open(sealed, 'household:1')).toBe('sk-ant-secret');
	});

	it('refuses a key that is not 32 bytes', () => {
		process.env.FIGGY_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
		expect(() => seal('x', 'household:1')).toThrow(/32 bytes/);
	});

	it('refuses to use the development key when hosted', () => {
		delete process.env.FIGGY_ENCRYPTION_KEY;
		process.env.VERCEL = '1';
		expect(() => seal('x', 'household:1')).toThrow(/not set/);
	});
});
