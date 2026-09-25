/**
 * Nightly backup.
 *
 * Uses SQLite's own backup API, never a file copy. In WAL mode the database
 * file on its own is not a database - the recent writes are in the -wal file -
 * so `cp garden.db` produces something that looks like a backup and restores
 * as corruption. The API takes a consistent snapshot of the live database
 * while it is being written to.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const source =
	process.env.GARDEN_DB_PATH ?? path.join(process.cwd(), 'data', 'garden.db');
const dir = process.env.GARDEN_BACKUP_PATH ?? path.join(process.cwd(), 'backups');
const keep = Number(process.env.GARDEN_BACKUP_KEEP ?? 30);

async function main() {
	// A database that is not there yet is worth waiting for rather than
	// failing over: on a fresh volume the app is still migrating.
	if (!fs.existsSync(source) || fs.statSync(source).size === 0) {
		console.error(`figgy backup: nothing to back up at ${source} yet`);
		process.exit(1);
	}
	fs.mkdirSync(dir, { recursive: true });

	const stamp = new Date().toISOString().slice(0, 10);
	const target = path.join(dir, `garden-${stamp}.db`);

	const db = new Database(source, { readonly: true });
	await db.backup(target);

	// The snapshot inherits WAL mode from its source, which leaves a -wal and
	// a -shm beside it and makes the backup three files instead of one.
	// Folding the journal in makes each snapshot a single file you can copy
	// anywhere, which is the whole point of having one.
	const snapshot = new Database(target);
	snapshot.pragma('journal_mode = delete');
	snapshot.close();
	for (const sidecar of [`${target}-wal`, `${target}-shm`]) {
		if (fs.existsSync(sidecar)) fs.rmSync(sidecar);
	}

	// Record it where the app can see it, so a silently dead backup job shows
	// up as an ageing date on the settings page rather than as nothing at all.
	const writable = new Database(source);
	writable
		.prepare(
			'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
		)
		.run('last_backup_at', new Date().toISOString());
	writable.close();
	db.close();

	const snapshots = fs
		.readdirSync(dir)
		.filter((name) => /^garden-\d{4}-\d{2}-\d{2}\.db$/.test(name))
		.sort();
	for (const old of snapshots.slice(0, Math.max(0, snapshots.length - keep))) {
		fs.rmSync(path.join(dir, old));
	}

	const size = fs.statSync(target).size;
	console.log(
		`figgy backup: ${target} (${(size / 1024).toFixed(0)} KB), keeping ${Math.min(snapshots.length, keep)}`,
	);
}

main().catch((error) => {
	console.error('figgy backup failed:', error);
	process.exit(1);
});
