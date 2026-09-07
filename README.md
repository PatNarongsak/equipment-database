# Equipment Management System

Department of Physics, Silpakorn University

A web application for recording, searching, editing, and tracking laboratory equipment across 5 condition statuses, with role-based access control, an activity log, a recoverable deletion archive, QR code generation/scanning, and smart Excel import (including direct support for the university's central asset report format).

## Project Structure

```
Equipment-Database/
├── backend/                      # Node.js + Express + better-sqlite3
│   ├── server.js
│   ├── database.js
│   ├── create-admin.js           # CLI script to create a new user
│   ├── set-role.js               # CLI script to change an existing user's role
│   ├── migrate-status-values.js  # One-time script: migrates old 3-status data to the 5-status scheme
│   ├── .env                      # Holds JWT_SECRET (not committed to git)
│   └── package.json
└── frontend/                      # React (Vite)
    ├── src/
    │   ├── App.jsx
    │   └── App.css
    ├── .env                       # Holds VITE_API_URL (not committed to git)
    └── package.json
```

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, JWT (jsonwebtoken), bcryptjs, Multer, ExcelJS, dotenv
- **Frontend:** React, Vite, SheetJS (xlsx), qrcode.react, html5-qrcode

## Getting Started

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/` (gitignored):

```
JWT_SECRET=replace-with-a-long-random-secret
```

Then start the server:

```bash
node server.js
```

On success:

```
Database initialized successfully.
🚀 Backend (better-sqlite3) Running on http://localhost:3000
```

> Keep this terminal open while using the app.

### 2. Frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside `frontend/` (gitignored):

```
VITE_API_URL=http://localhost:3000/api
```

Then start the dev server:

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Environment Variables

| Variable       | Location                     | Purpose                                           |
| -------------- | ---------------------------- | ------------------------------------------------- |
| `JWT_SECRET`   | `backend/.env`               | Signs and verifies login tokens                   |
| `PORT`         | (optional, hosting-provided) | Overrides the default port `3000` for the backend |
| `VITE_API_URL` | `frontend/.env`              | Base URL the frontend uses to reach the API       |

For a public demo (e.g. via a Cloudflare Tunnel), create `frontend/.env.local` with the tunnel's URL — it overrides `.env` without touching the tracked file. Also add the tunnel's domain to `server.allowedHosts` in `vite.config.js` (Vite blocks unrecognized Host headers by default).

## Equipment Status (5 categories)

Matches the categories used in the university's own central asset report, so status can sync directly from that file on import.

| Status       | Meaning                               |
| ------------ | ------------------------------------- |
| ใช้ได้       | Usable / in service                   |
| ชำรุดรอซ่อม  | Damaged, awaiting repair              |
| สิ้นสภาพ     | End of life / write-off               |
| ไม่มีให้ตรวจ | Not available for physical inspection |
| อื่นๆ        | Other                                 |

Any logged-in user can change an item's status from the dropdown in the table.

## User Roles

| Role                | Add / Edit basic fields\* | Edit serial number / received date | Change status | Delete | View log / recover deleted items | Manage users |
| ------------------- | ------------------------- | ---------------------------------- | ------------- | ------ | -------------------------------- | ------------ |
| `admin`             | ✅                        | ❌                                 | ✅            | ❌     | ❌                               | ❌           |
| `super_admin`       | ✅                        | ✅                                 | ✅            | ✅     | ✅                               | ❌           |
| `super_super_admin` | ✅                        | ✅                                 | ✅            | ✅     | ✅                               | ✅           |

\* Equipment name / building & room / responsible person / price

### Default Account

On first run, the system automatically creates an admin account with the highest privilege level (`super_super_admin`):

| Username | Password      |
| -------- | ------------- |
| admin    | adminpassword |

> Change this password after first login (see "Change Password" in the header menu).

### Managing Users

**Via the web UI** (`super_super_admin` only): the "Manage Users" button in the header lets you add new users and adjust roles between `admin` and `super_admin`.

**Via the server terminal** (required for granting `super_super_admin`, which cannot be set from the web UI):

```bash
cd backend

# Create a new user (defaults to role "admin" if omitted)
node create-admin.js <username> <password> [role]
node create-admin.js jsmith mySecurePass123
node create-admin.js jdoe mySecurePass456 super_admin

# Change an existing user's role (admin, super_admin, or super_super_admin)
node set-role.js <username> <role>
node set-role.js jsmith super_super_admin
```

> Stop the backend (`Ctrl+C`) before running these scripts to avoid two processes writing to the database file at once.

## Features

- Staff login (with "remember username") / guest mode (read-only, shows only equipment name, location, and responsible person — no serial number, price, or status)
- Add / edit / delete equipment (permissions vary by role)
- Change equipment status directly from the table (see the 5 categories above)
- Search by serial number, equipment name, building, room, or responsible person
- **QR codes**
  - Generate a printable/downloadable QR code per item (encodes the serial number) — available on desktop
  - Scan a QR code with the device camera to jump straight to that item — available on mobile/tablet (requires HTTPS, or `localhost`)
- **Excel import** — accepts `.xlsx` only. Columns are matched by header name (order and extra columns don't matter), so it also reads the university's central asset report format directly:
  - Recognizes both the app's own template headers (เลขครุภัณฑ์, ชื่ออุปกรณ์, ราคา (บาท), ...) and the central report's headers (สินทรัพย์, คำอธิบาย, ที่ตั้งสินทรัพย์ถาวร (ครุภัณฑ์), จำนวนเงิน, ...)
  - Automatically skips subtotal/category rows (rows with a label but no equipment name)
  - Reads status from the report's per-category breakdown columns (ใช้ได้ / ชำรุดรอซ่อม / สิ้นสภาพ / ไม่มีให้ตรวจ / อื่นๆ) when present, falling back to a plain status column, then to "ใช้ได้"
  - The uploaded file must contain exactly one sheet — extract the relevant sheet (e.g. "RawData") into its own workbook first if the source file has multiple
  - **New serial numbers** are inserted; **duplicate serial numbers only have their status updated** (if the file's status differs) — all other fields (name, price, location, etc.) are left untouched
- Export the currently filtered list to Excel
- **Activity log** — every add, edit, delete, status change, and import is recorded with the username responsible (accessible via "View Log")
- **Deleted-item recovery** — deleted equipment is archived for up to one year and can be viewed or exported to Excel via "Deleted Items" (auto-purged after one year)
- Change your own password
- Responsive layout for mobile and tablet: hamburger menu, collapsible "add equipment" form, horizontally-scrollable table

## Utility Scripts

| Script                     | Purpose                                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create-admin.js`          | Create a new user account from the command line                                                                                                                                         |
| `set-role.js`              | Change an existing user's role, including granting `super_super_admin`                                                                                                                  |
| `migrate-status-values.js` | One-time migration: converts old status values (`available`/`damaged`/`lost`) to the current 5-category scheme. Only needed if upgrading a database created before the 5-status system. |

## Notes

- The database is a single SQLite file (`physics_inventory.db`) inside `backend/` — back it up periodically.
- Excel import requires a header row (row 1) with recognized column names, including at minimum a serial number column and a name column.
- Imported rows with no matching status information default to "ใช้ได้".
- The QR camera scanner requires HTTPS (or `localhost`) — it will not work over a plain `http://` connection on another device's IP address.
