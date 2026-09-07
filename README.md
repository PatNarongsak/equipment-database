# Equipment Management System

Department of Physics, Silpakorn University

A web application for recording, searching, editing, and tracking the status of laboratory equipment (Available / Damaged / Lost), with role-based access control, an activity log, a recoverable deletion archive, QR code generation/scanning, and Excel import/export.

## Project Structure

```
Equipment-Database/
├── backend/                # Node.js + Express + better-sqlite3
│   ├── server.js
│   ├── database.js
│   ├── create-admin.js     # CLI script to create a new user
│   ├── set-role.js         # CLI script to change an existing user's role
│   ├── .env                # Holds JWT_SECRET (not committed to git)
│   └── package.json
└── frontend/                # React (Vite)
    ├── src/
    │   ├── App.jsx
    │   └── App.css
    ├── .env                 # Holds VITE_API_URL (not committed to git)
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

Create a `.env` file inside `backend/` (this file is gitignored):

```
JWT_SECRET=replace-with-a-long-random-secret
```

Then start the server:

```bash
node server.js
```

On success you should see:

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

Create a `.env` file inside `frontend/` (also gitignored):

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

For a public demo (e.g. via a Cloudflare Tunnel or ngrok), create `frontend/.env.local` with the tunnel's URL — it takes priority over `.env` without touching the tracked file. Also add the tunnel's domain to `server.allowedHosts` in `vite.config.js` (Vite blocks unrecognized Host headers by default).

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

- Staff login (with "remember username") / guest mode (read-only)
- Add / edit / delete equipment (permissions vary by role)
- Change equipment status directly from the table: **Available**, **Damaged**, **Lost**
- Search by serial number, equipment name, building, room, or responsible person
- **QR codes** — generate a printable/downloadable QR code per item (encodes the serial number), and scan a QR code with the device camera to jump straight to that item
- Import from Excel (`.xlsx` / `.xls`) — columns are matched by header name, so column order and extra columns don't matter
- Export the currently filtered list to Excel
- **Activity log** — every add, edit, delete, status change, and import is recorded with the username responsible (accessible via "View Log")
- **Deleted-item recovery** — deleted equipment is archived for up to one year and can be viewed or exported to Excel via "Deleted Items" (auto-purged after one year)
- Change your own password
- Responsive layout for mobile and tablet, including a hamburger menu on small screens

## Notes

- The database is a single SQLite file (`physics_inventory.db`) inside `backend/` — back it up periodically.
- Excel import requires a header row (row 1) with column names the system recognizes, including at minimum "เลขครุภัณฑ์" (serial number) and "ชื่ออุปกรณ์" (equipment name). Exporting from the system first produces a template guaranteed to match.
- Imported rows always default to status "Available" (status is not read from the file).
- The QR camera scanner requires HTTPS (or `localhost`) — it will not work over a plain `http://` connection on another device's IP address.
