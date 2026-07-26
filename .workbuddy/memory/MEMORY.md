# Snow Box Project Memory

## Project Overview
- **Type**: Game cloud save & game sharing platform
- **Stack**: Flask (Python) backend + vanilla HTML/CSS/JS frontend + Cloudflare Worker deployment
- **Storage**: Strategy pattern (LocalStorage / CloudflareR2 / AliyunOSS) via `cloud_storage.py`
- **Database**: SQLite (local dev), Cloudflare D1 (production)
- **Deployment**: Two Cloudflare Worker versions — `worker.js` (D1) and `worker-r2.js` (R2+KV)

## Key Architecture Decisions
- **Secret code `&&*SA*&&`**: Hidden in username field, triggers superadmin upgrade (both frontend `dashboard.js` and backend `server.py`/`worker.js`)
- **File chunking**: D1 version splits files into 512KB chunks (`file_chunks` table) to work around D1's 1MB row limit
- **Save group nesting**: Tree structure via `parent_id`, max 10 levels depth, recursive BFS traversal in backend
- **Role hierarchy**: user → developer → admin → superadmin
- **Folder upload**: Uses `webkitRelativePath` to preserve directory hierarchy
- **ZIP download**: Frontend JSZip packaging, parallel file downloads with Promise.all

## File Annotation Status (Completed 2026-07-23)
All source files have been annotated with comprehensive comments:
- `server.py` — Flask backend, all API routes documented
- `cloud_storage.py` — Storage abstraction layer with Strategy pattern
- `worker.js` — Cloudflare Worker D1 version (already had comments)
- `worker-r2.js` — Cloudflare Worker R2+KV version, fully annotated
- `js/dashboard.js` — 2601 lines, all ~50 functions have JSDoc, 8 section headers added
- `js/auth.js` — Already well-commented
- `database_schema.sql` — Already well-commented
- Python utility scripts: `create_superadmin.py`, `fix_db.py`, `migrate_db.py`, `migrate_db_v2.py`, `reset_db.py`, `reset_password.py`, `list_users.py`
