# Timeless Admin Utility

A terminal-based admin tool for managing a multi-user [SillyTavern](https://github.com/SillyTavern/SillyTavern) instance. Built for server operators who need to push content, edit settings, manage lorebooks, and perform maintenance tasks across 30-100+ users without doing it all by hand.

## Features

| Menu Item | What It Does |
|---|---|
| **Push Character Cards** | Copy character PNGs to all (or selected) users instantly, or add to scaffold/content index for automatic seeding on restart |
| **Bulk Edit settings.json** | Set specific key/value pairs via dot-paths, sync sections from a golden template, or link lorebooks across users |
| **Create Lorebook Symlinks** | Symlink a lorebook from scaffold into every user's `worlds/` directory so edits to one file propagate to everyone |
| **Edit Scaffold index.json** | Add, remove, or edit entries in the scaffold index through an interactive editor |
| **Fresh Login Reset** | Delete `cookie-secret.txt` and restart SillyTavern via pm2 in one action — forces all users to log in again |
| **List Users / View Details** | See all users with character, chat, and world counts, or drill into a single user's details including symlink status |
| **Backup Operations** | Bulk backup `settings.json`, `secrets.json`, or `content.log` for all users into a timestamped directory |
| **Bulk Delete Content** | Remove a specific character card or lorebook from selected users (with optional backup first) |
| **Reset Content Log** | Delete `content.log` for selected users to re-trigger scaffold content seeding on the next restart |

## Requirements

- **Node.js 18+**
- **pm2** (for server restart functionality)
- A SillyTavern instance running in multi-user mode

## Setup

```bash
git clone <repo-url> /root/timeless-admin
cd /root/timeless-admin
npm install --production
```

Edit `config.json` to match your environment (or delete it and the utility will walk you through setup on first run):

```json
{
  "stRoot": "/root/SillyTavern",
  "dataRoot": "/root/SillyTavern/data",
  "scaffoldDir": "/root/SillyTavern/data/default/scaffold",
  "contentDir": "/root/SillyTavern/data/default/content",
  "backupRoot": "/root/SillyTavern/data/_admin-backups",
  "excludeDirs": ["default", "_storage"],
  "serverPort": 8000,
  "pm2Name": "SillyTavern",
  "dryRun": false
}
```

## Usage

```bash
node index.js
```

The interactive menu uses arrow keys to navigate. Every batch operation lets you choose "all users" or pick specific users from a list. Progress bars and per-user error reporting are shown for all multi-user operations.

### Dry Run Mode

Set `"dryRun": true` in `config.json` to preview what every operation would do without actually modifying any files.

## Project Structure

```
timeless-admin/
├── index.js                        # Entry point
├── config.json                     # Paths and runtime config
├── src/
│   ├── config.js                   # Config loader + first-run setup
│   ├── menu.js                     # Main menu loop
│   ├── ui.js                       # Banner, colors, formatting
│   ├── users.js                    # User discovery + selection
│   ├── backup.js                   # Backup-before-modify helpers
│   ├── batch.js                    # Batch runner with progress bars
│   ├── modules/
│   │   ├── push-characters.js
│   │   ├── bulk-settings.js
│   │   ├── lorebook-symlinks.js
│   │   ├── scaffold-editor.js
│   │   ├── fresh-login.js
│   │   ├── user-info.js
│   │   ├── backup-ops.js
│   │   ├── bulk-delete.js
│   │   └── reset-content-log.js
│   └── lib/
│       ├── st-paths.js             # SillyTavern path helpers
│       ├── json-merge.js           # Deep merge + dot-path mutations
│       ├── content-index.js        # Scaffold/content index.json I/O
│       └── process-manager.js      # pm2 restart + health checks
```

## Notes

- **Backups are automatic.** Every file modification (settings, content logs, lorebooks) creates a timestamped backup before writing. Per-user backups go to `{user}/backups/admin-snapshots/`. Bulk admin backups go to `_admin-backups/`.
- **Symlinked lorebooks should not be listed in `scaffold/index.json`** — the SillyTavern seeder would overwrite symlinks with regular file copies on restart. The utility warns you if it detects this conflict.
- **One failure never stops the batch.** If a single user's `settings.json` is malformed or a directory is missing, that user is skipped and reported at the end. Every other user still gets processed.
