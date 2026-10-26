/**
 * Runs before any test module is imported.
 *
 * Without this, a test file that imports anything touching the database - even
 * indirectly, through a module that imports the client - opens the real
 * garden.db at load time, before any test has had the chance to point it
 * somewhere safe. That is not a hypothetical: it happened, and it wrote test
 * plants into the actual garden.
 *
 * Pointing TURSO_DATABASE_URL at a temp file here means the real database is
 * unreachable from the test run, whatever a test file imports. The auth token
 * goes too, and lib/db/client.ts refuses anything but a local file under
 * vitest, so a hosted database is out of reach as well.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figgy-vitest-'));
process.env.TURSO_DATABASE_URL = `file:${path.join(dir, 'default.db')}`;
delete process.env.TURSO_AUTH_TOKEN;
