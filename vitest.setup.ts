/**
 * Runs before any test module is imported.
 *
 * Without this, a test file that imports anything touching the database - even
 * indirectly, through a module that imports the client - opens the real
 * garden.db at load time, before any test has had the chance to point it
 * somewhere safe. That is not a hypothetical: it happened, and it wrote test
 * plants into the actual garden.
 *
 * Pointing GARDEN_DB_PATH at a temp file here means the real database is
 * unreachable from the test run, whatever a test file imports.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figgy-vitest-'));
process.env.GARDEN_DB_PATH = path.join(dir, 'default.db');
