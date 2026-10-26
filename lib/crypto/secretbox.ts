/**
 * Keeping a secret in the database without the database being able to read it.
 *
 * AES-256-GCM, with the key in FIGGY_ENCRYPTION_KEY (32 random bytes, base64)
 * and never in the database. Each value is bound to the row it belongs to
 * through the associated data - "household:7" - so a ciphertext copied onto
 * another household's row will not decrypt there. GCM's tag makes any
 * tampering a failure rather than garbage.
 *
 * Stored as v1.<iv>.<tag>.<ciphertext>, base64url. The version is for the day
 * the scheme changes; FIGGY_ENCRYPTION_KEY_PREVIOUS is for the day the key
 * does: values sealed with the old key still open while they are re-sealed.
 */
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from 'node:crypto';

const VERSION = 'v1';

function keyFrom(value: string, name: string): Buffer {
	const key = Buffer.from(value, 'base64');
	if (key.length !== 32) {
		throw new Error(
			`${name} must be 32 bytes, base64. Make one with: openssl rand -base64 32`,
		);
	}
	return key;
}

/**
 * The current key. On a laptop with none set, a fixed development key - which
 * is fine for keys typed into a local database and refused anywhere hosted.
 */
function currentKey(): Buffer {
	const value = process.env.FIGGY_ENCRYPTION_KEY;
	if (value) return keyFrom(value, 'FIGGY_ENCRYPTION_KEY');
	if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
		throw new Error('FIGGY_ENCRYPTION_KEY is not set.');
	}
	return createHash('sha256').update('figgy development only').digest();
}

function previousKey(): Buffer | null {
	const value = process.env.FIGGY_ENCRYPTION_KEY_PREVIOUS;
	return value ? keyFrom(value, 'FIGGY_ENCRYPTION_KEY_PREVIOUS') : null;
}

export function seal(plaintext: string, context: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', currentKey(), iv);
	cipher.setAAD(Buffer.from(context));
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, 'utf8'),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return [VERSION, iv, tag, ciphertext]
		.map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
		.join('.');
}

function openWith(
	key: Buffer,
	iv: Buffer,
	tag: Buffer,
	ciphertext: Buffer,
	context: string,
) {
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAAD(Buffer.from(context));
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
		'utf8',
	);
}

/** The secret, or a thrown error if the key, the context or the bytes are wrong. */
export function open(sealed: string, context: string): string {
	const [version, iv, tag, ciphertext] = sealed.split('.');
	if (version !== VERSION || !iv || !tag || !ciphertext) {
		throw new Error('Not a sealed value figgy can read.');
	}
	const parts = [iv, tag, ciphertext].map((p) => Buffer.from(p, 'base64url')) as [
		Buffer,
		Buffer,
		Buffer,
	];
	try {
		return openWith(currentKey(), ...parts, context);
	} catch (error) {
		const previous = previousKey();
		if (!previous) throw error;
		return openWith(previous, ...parts, context);
	}
}
