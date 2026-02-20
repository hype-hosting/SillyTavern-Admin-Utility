# CLAUDE.md — Timeless Admin Utility

## What This Is

Node.js ESM terminal utility for managing a multi-user SillyTavern instance on a Digital Ocean droplet. Interactive TUI with arrow-key menus, batch operations across 30-100+ users, automatic backups, and dry-run mode.

- **Production**: `/root/timeless-admin/` on the droplet
- **SillyTavern**: `/root/SillyTavern/`, data at `/root/SillyTavern/data/`
- **Server**: managed by pm2
- **Local dev**: `/Users/jonathanwomack/Documents/GitHub/hype-hosting/Timeless Admin Utility`
- **Repo**: https://github.com/hype-hosting/SillyTavern-Admin-Utility

## Running

```bash
node index.js          # Interactive menu
# Or on droplet:
cd /root/timeless-admin && node index.js
```

Set `"dryRun": true` in `config.json` to preview operations without modifying files.

## Architecture

```
index.js → src/config.js → src/menu.js → src/modules/*.js
```

**Every module** exports `async function run(config)`. The menu dynamically imports modules and calls `run()`. Config is a frozen object loaded from `config.json`.

### Key Files

| File | Purpose |
|------|---------|
| `src/config.js` | Loads/validates `config.json`, interactive setup on first run |
| `src/menu.js` | Main menu loop, dynamic module routing via `MODULES` registry |
| `src/users.js` | `discoverUsers()` scans data dir, `selectUsers()` prompts all-or-pick |
| `src/batch.js` | `batchOperation(users, fn, label)` — progress bar + per-user error isolation |
| `src/backup.js` | `backupUserFile()` and `backupToAdmin()` — timestamped backups before writes |
| `src/ui.js` | `printBanner()`, `printHeader()`, `printBatchReport()`, colored output helpers |

### Libraries (src/lib/)

| File | Purpose |
|------|---------|
| `st-paths.js` | Pure path builders: `userSettingsPath()`, `userWorldsDir()`, `cookieSecretPath()`, etc. |
| `json-merge.js` | `applyMutations()` (dot-path set), `syncSections()`, `parseValue()` (auto type detect) |
| `content-index.js` | CRUD on scaffold/content `index.json` arrays |
| `process-manager.js` | `restartServer()` via pm2, `checkServerHealth()`, `getServerStatus()` |

### Modules (src/modules/)

| Module | Menu Item |
|--------|-----------|
| `push-characters.js` | Copy character PNGs to users or add to scaffold index |
| `bulk-settings.js` | charLore entries, dot-path key/values, template sync, lorebook linking |
| `lorebook-symlinks.js` | Symlink lorebooks from scaffold → user worlds/ dirs |
| `scaffold-editor.js` | Interactive CRUD on scaffold/index.json |
| `fresh-login.js` | Delete cookie-secret.txt + pm2 restart |
| `user-info.js` | List users with stats, view individual details |
| `backup-ops.js` | Bulk backup settings/secrets/content.log |
| `bulk-delete.js` | Remove specific files from selected users |
| `reset-content-log.js` | Delete content.log to re-trigger scaffold seeding |

## Conventions

### Module pattern
```javascript
export async function run(config) { /* ... */ }
```

### Cancellation handling (every @clack/prompts call)
```javascript
const result = await text({ message: '...' });
if (typeof result === 'symbol') return;  // Ctrl+C
```

### Dry-run
```javascript
if (config.dryRun) {
  info(`[DRY RUN] Would do X`);
} else {
  // actual operation
}
```
Note: `backupUserFile()` and `backupToAdmin()` handle dryRun internally.

### Batch operation return values
```javascript
return 'success';              // → counted in results.success
return { skipped: 'reason' };  // → counted in results.skipped
throw new Error('msg');        // → caught, counted in results.failed
```

### Node 18 compatibility
Use `fileURLToPath(import.meta.url)` not `import.meta.dirname`.

### Arrays in deep merge
Arrays are **replaced** (not concatenated):
```javascript
deepmerge(target, patch, { arrayMerge: (_t, source) => source });
```

## SillyTavern Data Structure

```
/root/SillyTavern/data/
├── {user-handle}/           # One per user (lowercase, numbers, dashes)
│   ├── characters/          # Character card PNGs (embedded JSON metadata)
│   ├── chats/{char}/        # JSONL chat files
│   ├── worlds/              # Lorebook/World Info JSON files
│   ├── settings.json        # User preferences (the big one we edit)
│   ├── secrets.json         # Encrypted API keys
│   ├── content.log          # Tracks seeded content (text, one entry per line)
│   └── backups/
│       └── admin-snapshots/ # Our per-user backups go here
├── default/
│   ├── scaffold/
│   │   ├── index.json       # Scaffold content definitions
│   │   └── worlds/          # Shared lorebook files (symlink sources)
│   └── content/
│       └── index.json       # Distributable content definitions
├── _storage/                # node-persist user account data
├── _admin-backups/          # Our bulk backup directory
└── cookie-secret.txt        # Session signing key (delete to force re-login)
```

**User discovery**: dirs under `data/` excluding `default`, `_storage`, dotfiles, underscore-prefixed.

## Important: charLore Structure

The most-used feature. Located at `world_info_settings.world_info.charLore` in settings.json:

```json
{
  "world_info_settings": {
    "world_info": {
      "charLore": [
        {
          "name": "Brennan",
          "extraBooks": [
            "Z-hyperion-Brennan",
            "Z-hyperion-prompt",
            "Z-hyperion-Ravenwood"
          ]
        }
      ]
    }
  }
}
```

Each entry: `{ name: "CharacterName", extraBooks: ["lorebook1", "lorebook2"] }`. Duplicate names are replaced (not appended).

## Important: Symlink Rules

- Symlinks use **absolute paths** (scaffold → user worlds/)
- Symlinked lorebooks should **NOT** be listed in `scaffold/index.json` — the SillyTavern seeder would overwrite symlinks with regular file copies on restart
- The utility warns about this conflict when creating symlinks

## Backups

- **Per-user**: `{handle}/backups/admin-snapshots/{file}.{YYYY-MM-DD-HHMMSS}.bak`
- **Bulk admin**: `_admin-backups/{label}-{YYYY-MM-DD-HHMMSS}/{handle}/{file}`
- Every file modification is preceded by a backup automatically

## Deployment

```bash
# From droplet:
cd /root/timeless-admin && git pull
# No npm install needed unless dependencies changed
```

## Dependencies

@clack/prompts, chalk, cli-progress, deepmerge, glob, lodash.get, lodash.set
