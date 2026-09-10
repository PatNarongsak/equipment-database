# Equipment Management System

Department of Physics, Silpakorn University

A web application for recording, searching, editing, and tracking laboratory equipment across 5 condition statuses, with role-based access control, an activity log, a write-off archive (แทงจำหน่าย) with a required equipment photo, QR code and barcode scanning, and smart Excel import (including direct support for the university's central asset report format).

## Project Structure

```
Equipment-Database/
├── backend/                      # Node.js + Express + better-sqlite3
│   ├── server.js
│   ├── database.js               # Schema + auto-migrations, runs on startup
│   ├── create-admin.js           # CLI script to create a new user
│   ├── set-role.js               # CLI script to change an existing user's role
│   ├── .env                      # Holds JWT_SECRET (not committed to git)
│   └── package.json
└── frontend/                      # React (Vite)
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── hooks/                 # useAuth, useEquipments, useAdminPanels, useQRCode
    │   └── components/            # Table, forms, modals (incl. WriteoffModal), scanners
    ├── .env                       # Holds VITE_API_URL (not committed to git)
    └── package.json
```

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, JWT (jsonwebtoken), bcryptjs, Multer, ExcelJS, sharp (image compression), dotenv
- **Frontend:** React, Vite, SheetJS (xlsx), qrcode.react, html5-qrcode (QR + 1D barcode)

> `sharp` is a native module. On a fresh server run `npm install` in `backend/` so its platform binary is fetched.

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

| Role                | Add equipment / Excel import | Edit location & responsible person | Edit name / price / serial number / received date | Change status | Write-off (แทงจำหน่าย) | View log / write-off archive | Manage users |
| ------------------- | --------------------------- | ---------------------------------- | ------------------------------------------------ | ------------- | --------------------- | ---------------------------- | ------------ |
| `admin`             | ❌                          | ✅                                 | ❌                                               | ✅            | ❌                    | ❌                           | ❌           |
| `super_admin`       | ✅                          | ✅                                 | ✅                                               | ✅            | ✅                    | ✅                           | ❌           |
| `super_super_admin` | ✅                          | ✅                                 | ✅                                               | ✅            | ✅                    | ✅                           | ✅           |

Location = building & room. A regular `admin` is intentionally limited: they can only change an item's status and edit its location / responsible person. Adding equipment, importing from Excel, and editing name / price / serial / date all require `super_admin` or above.

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
- Add / edit equipment, and write off (แทงจำหน่าย) equipment with a required photo (permissions vary by role)
- Change equipment status directly from the table (see the 5 categories above)
- Search by serial number, equipment name, building, room, or responsible person
- **QR codes**
  - Generate a printable/downloadable QR code per item (encodes the serial number) — available on desktop
  - Scan a QR code with the device camera to jump straight to that item — available on mobile/tablet (requires HTTPS, or `localhost`)
- **Barcode scanning** — a second camera button next to "Scan QR" (mobile/tablet only) reads 1D barcodes (CODE 128/39/93, EAN, UPC, ITF, Codabar) from the equipment sticker and drops the value into the search box
- **Excel import** — accepts `.xlsx` only. Columns are matched by header name (order and extra columns don't matter), so it also reads the university's central asset report format directly:
  - Recognizes both the app's own template headers (เลขครุภัณฑ์, ชื่ออุปกรณ์, ราคา (บาท), ...) and the central report's headers (สินทรัพย์, คำอธิบาย, ที่ตั้งสินทรัพย์ถาวร (ครุภัณฑ์), จำนวนเงิน, ...)
  - Automatically skips subtotal/category rows (rows with a label but no equipment name)
  - Reads status from the report's per-category breakdown columns (ใช้ได้ / ชำรุดรอซ่อม / สิ้นสภาพ / ไม่มีให้ตรวจ / อื่นๆ) when present, falling back to a plain status column, then to "ใช้ได้"
  - The uploaded file must contain exactly one sheet — extract the relevant sheet (e.g. "RawData") into its own workbook first if the source file has multiple
  - **New serial numbers** are inserted; **duplicate serial numbers only have their status updated** (if the file's status differs) — all other fields (name, price, location, etc.) are left untouched
- Export the currently filtered list to Excel
- **Activity log** — every add, edit, write-off, status change, and import is recorded with the username responsible (accessible via "View Log")
- **Write-off archive (รายการแทงจำหน่าย)** — `super_admin` and above
  - Writing off an item requires attaching a photo (or ticking "no photo" and giving a reason). The photo is compressed server-side with `sharp` (longest edge 1280px, JPEG q72, EXIF stripped — typically 150–250 KB) and stored as a BLOB.
  - The text record (serial, name, price, who, when, note) is kept **permanently** — it is never purged.
  - **Export to Excel** is generated server-side and embeds each item's photo in a trailing column. This exported file is the long-term archive of the photos.
  - **Purge old photos** — an assisted button clears photo blobs older than *N* months, but only for photos that have already been included in an export. It shows the count and size first, and never touches the text record. Runs `VACUUM` afterwards to shrink the database file.
- Change your own password
- Responsive layout for mobile and tablet: hamburger menu, collapsible "add equipment" form, horizontally-scrollable table

## Utility Scripts

| Script            | Purpose                                                               |
| ----------------- | -------------------------------------------------------------------- |
| `create-admin.js` | Create a new user account from the command line                       |
| `set-role.js`     | Change an existing user's role, including granting `super_super_admin` |

## Notes

- The database is a single SQLite file (`physics_inventory.db`) inside `backend/` — back it up periodically. Write-off photos are stored inside this same file, so one backup covers everything.
- Schema changes and column additions run automatically from `database.js` on startup; no manual migration step.
- Recommended write-off photo workflow: export the write-off list to Excel every few months (the export embeds the photos), then use "Purge old photos" to reclaim space — it only clears photos that have already been exported.
- Excel import requires a header row (row 1) with recognized column names, including at minimum a serial number column and a name column.
- Imported rows with no matching status information default to "ใช้ได้".
- The QR camera scanner requires HTTPS (or `localhost`) — it will not work over a plain `http://` connection on another device's IP address.
