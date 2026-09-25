# Running figgy at home

## Once

Nothing, strictly. figgy is reachable from anything on the network as soon as
it is up, at the Mac's own name — `http://<your-mac-name>.local:3000` — or at
its IP.

If you want a nicer name, set **System Settings → General → Sharing → Local
hostname** to `pinkpalace` and it becomes `http://pinkpalace.local:3000`.
Reserving a static DHCP lease on the router is worth doing either way, because
mDNS occasionally sulks and an IP always works.

If you want the plant lookup and the chat, put the key somewhere the compose
file can read it:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > ops/.env
```

`ops/.env` is gitignored. figgy runs fine without it; those features explain
themselves and everything else is unaffected.

## Up

```bash
npm run docker:up
```

Then `http://pinkpalace.local:3000` from anything on the network. Add it to
the phone's home screen and it opens without browser chrome.

`npm run docker:logs` follows the server, `npm run docker:down` stops it.

## Where the data lives

The database is in a **named Docker volume**, not a bind mount. SQLite on a
macOS bind mount has well-known file-locking trouble; inside the Linux VM it
behaves. The consequence is that you cannot open the file directly from the
Finder — which is what the backups are for.

Backups go to `./backups` on the Mac, one snapshot a night, thirty kept. They
are taken with SQLite's backup API rather than a file copy: in WAL mode the
`.db` file alone is not a complete database, so a copy of it restores as
corruption.

`/settings` shows the age of the last backup, so a job that has quietly died
shows up as an ageing date rather than as nothing at all.

## Restoring

```bash
docker compose -f ops/compose.yml down
docker run --rm -v figgy_figgy-data:/data -v "$PWD/backups":/backups alpine \
  sh -c "cp /backups/garden-2026-09-25.db /data/garden.db && rm -f /data/garden.db-wal /data/garden.db-shm"
npm run docker:up
```

## Two things to know

**Docker Desktop has to be running** for figgy to come back after a reboot.
`restart: unless-stopped` restarts the container, not Docker itself.

**A sleeping Mac serves nothing**, whatever the restart policy says. If you
want figgy reachable at all hours, stop the machine sleeping in Energy Saver.
