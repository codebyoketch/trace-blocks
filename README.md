# TraceBlocks

> A blockchain-powered supply chain traceability system built on Django, VeChain, and React Native (Expo).

TraceBlocks enables vendors, manufacturers, and logistics handlers to record every step of a product's journey — from origin to consumer — on an immutable public ledger. Every checkpoint is stored both in a local Django database for fast querying and on the VeChain blockchain for tamper-proof verification. A companion mobile app for Android and iOS allows field agents to log events, scan QR codes, and view live product routes from any device.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Mobile App Setup](#mobile-app-setup)
- [Blockchain Integration](#blockchain-integration)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Endpoints](#api-endpoints)
- [Mobile API](#mobile-api)
- [How It Works](#how-it-works)
- [Running Tests](#running-tests)
- [Contributing](#contributing)

---

## Overview

Traditional supply chain systems rely on centralised databases controlled by a single party. Records can be altered, deleted, or backdated — making it impossible for consumers, regulators, or auditors to independently verify a product's history.

TraceBlocks solves this by writing every tracking event to the **VeChain blockchain** at the moment it is recorded. Once written, the data is permanent and publicly verifiable. No party — including the system owner — can change it.

The Django backend handles all business logic, authentication, fast database queries, and the web interface. VeChain acts as an immutable audit trail. A React Native mobile app gives field agents a companion tool that works on any Android or iOS device.

---

## Features

### Web Application
- Register products with SKU, manufacturer, and description
- Record tracking events at every checkpoint — manufactured, shipped, in transit, at hub, out for delivery, delivered
- Record full custody handovers with outgoing/incoming transporter details, quantities, signatures, and discrepancy notes
- GPS coordinates captured from the browser at the time of logging (requires HTTPS)
- Interactive Leaflet route map showing the product's movement across all recorded GPS points
- GPS coordinate pill on every timeline event linking to OpenStreetMap
- Every event written to VeChain testnet with a real transaction ID
- Live transaction status polling — pending, confirmed, reverted, error
- Blockchain explorer links for every event
- Graceful degradation — app keeps working if VeChain is unreachable
- Django admin panel for full data visibility
- Clean, responsive web interface

### Mobile App (Expo React Native)
- Login with email and password using token-based auth
- Product list with current status, event count, and last known location
- QR code scanner — scan an event QR to log a quick status update against that product
- Manual event logging — pick any product, select status, capture GPS, submit to VeChain
- Full handover recording from the mobile app
- Create new products directly from the app
- Interactive map with all products pinned at their last known GPS location
- Per-product route map showing the full movement history as a polyline
- Event history timeline per product with TX status and GPS coordinates
- Account management — edit profile, change password, logout from all devices
- Bottom tab navigation — Products, Map, Log, Account

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, Django 6.0 |
| REST API | Django REST Framework + Token Auth |
| Database | SQLite (development) |
| Blockchain | VeChain (Thor protocol), testnet |
| Blockchain SDK | thor-devkit 1.0.14 |
| Mobile | React Native (Expo SDK 56), React Navigation |
| Maps (web) | Leaflet.js + OpenStreetMap |
| Maps (mobile) | react-native-maps |
| GPS (web) | Browser Geolocation API |
| GPS (mobile) | expo-location |
| QR scanning | expo-camera, expo-barcode-scanner |
| Secure storage | expo-secure-store |
| HTTP client | axios |
| Version Control | Git / GitHub |

---

## Project Structure

```
trace-blocks/
├── traceblocks/                  # Django project root
│   ├── traceblocks/
│   │   ├── settings.py
│   │   └── urls.py
│   ├── tracker/
│   │   ├── models.py             # Product, TrackingEvent, User
│   │   ├── views.py              # Web UI views
│   │   ├── api_views.py          # Mobile REST API views
│   │   ├── urls.py               # All URL routes
│   │   ├── blockchain.py         # VeChainService
│   │   ├── backends.py           # Email auth backend
│   │   └── migrations/
│   │       ├── 0001_initial.py
│   │       ├── 0002_trackingevent_latitude_longitude.py
│   │       └── 0003_trackingevent_qr_token.py
│   └── manage.py
│
└── mobile/                       # Expo React Native app
    ├── App.js                    # Navigation root with bottom tabs
    ├── src/
    │   ├── services/
    │   │   ├── api.js            # All axios calls to Django
    │   │   └── auth.js           # Token storage with expo-secure-store
    │   ├── components/
    │   │   └── StatusPicker.js   # Status dropdown matching Django choices
    │   └── screens/
    │       ├── LoginScreen.js
    │       ├── HomeScreen.js
    │       ├── ScanScreen.js
    │       ├── LogEventScreen.js
    │       ├── HistoryScreen.js
    │       ├── MapScreen.js
    │       ├── CreateProductScreen.js
    │       ├── ManualLogScreen.js
    │       └── AccountScreen.js
    └── package.json
```

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/codebyoketch/trace-blocks.git
cd trace-blocks/traceblocks
```

### 2. Create and activate a virtual environment

```bash
# Linux / macOS
python3.12 -m venv tracer
source tracer/bin/activate

# Windows
python3.12 -m venv tracer
tracer\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

`requirements.txt` must include:
```
django
djangorestframework
python-dotenv
requests
thor-devkit
```

### 4. Set up environment variables

Create a `.env` file at `traceblocks/` (same folder as `manage.py`):

```
super_secret_key2=YOUR_VECHAIN_PRIVATE_KEY_HEX
super_secret_key3=https://node-testnet.vechain.energy
```

See [Environment Variables](#environment-variables) for details.

### 5. Run migrations

```bash
python manage.py migrate
```

### 6. Create a superuser

```bash
python manage.py createsuperuser
```

### 7. Start the development server

```bash
# For local browser access only
python manage.py runserver

# To also accept connections from the mobile app on your LAN
python manage.py runserver 0.0.0.0:8000
```

Visit `http://127.0.0.1:8000` in your browser.

---

## Mobile App Setup

### 1. Install dependencies

```bash
cd mobile
npm install
npx expo install expo-camera expo-barcode-scanner expo-location expo-secure-store
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context react-native-maps
npm install axios
```

### 2. Configure the API base URL

Open `src/services/api.js` and set `BASE_URL` to your machine's LAN IP:

```js
export const BASE_URL = 'http://YOUR_LAN_IP:8000';
```

Find your LAN IP with:
```bash
hostname -I | awk '{print $1}'
```

Also add your LAN IP to Django's `ALLOWED_HOSTS` in `settings.py`:
```python
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'YOUR_LAN_IP', 'your-render-domain.onrender.com']
```

### 3. Start the app

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your Android or iOS device.

> **Note:** GPS capture requires HTTPS. On a local network over HTTP, GPS works on `localhost` only. Use your Cloudflare tunnel or Render deployment URL for GPS on real devices.

---

## Blockchain Integration

TraceBlocks uses a **hybrid architecture**:

- **Django DB** — stores all data locally for fast queries and UI rendering
- **VeChain** — receives every tracking event at the moment it is created, producing a permanent on-chain record

When a tracking event is logged:

1. Django saves the event to the local database immediately
2. `VeChainService` constructs a transaction containing the event payload as JSON encoded in the `data` field
3. The transaction is signed using `thor-devkit 1.0.x` — specifically `tx.get_signing_hash()` and `tx.set_signature()`
4. The signed transaction is broadcast to the VeChain testnet node
5. The returned transaction ID is saved to the event record
6. `tx_status` starts as `pending` and is polled until `confirmed` or `reverted`
7. If VeChain is unreachable, `tx_status` is set to `error` and the app continues normally

The payload is a compact JSON object stripped of empty fields to minimise gas usage. It includes event type, location, goods details, dispatcher/recipient info, logistics metadata, and GPS coordinates.

### Verifying on the Explorer

Every transaction can be verified at:
```
https://insight.vecha.in/#/test/txs/<tx_id>
```

---

## Environment Variables

| Django settings key | `.env` variable name | Description |
|---|---|---|
| `VECHAIN_PRIVATE_KEY` | `super_secret_key2` | Hex private key of your VeChain testnet wallet |
| `VECHAIN_NODE_URL` | `super_secret_key3` | VeChain node URL — use `https://node-testnet.vechain.energy` |
| `VECHAIN_CHAIN_TAG` | hardcoded in settings | `0x27` for testnet |

To generate a testnet wallet and fund it with VTHO:

```bash
python manage.py shell -c "
from thor_devkit import cry
priv = cry.secp256k1.generate_privatekey()
pub  = cry.secp256k1.derive_publickey(priv)
addr = cry.public_key_to_address(pub)
print('Private key:', priv.hex())
print('Address:    ', '0x' + addr.hex())
"
```

Then visit [https://faucet.vecha.in](https://faucet.vecha.in) to fund the address with testnet VTHO.

**Never commit your `.env` file:**
```bash
echo ".env" >> .gitignore
```

---

## Running the App

```bash
source tracer/bin/activate
python manage.py runserver 0.0.0.0:8000
```

| URL | Description |
|---|---|
| `/` | Sign up |
| `/login/` | Login |
| `/interface/` | Dashboard |
| `/index` | All products |
| `/products/<sku>/` | Product detail, event timeline, route map |
| `/products/new/` | Register a new product |
| `/products/<sku>/events/` | Add a tracking event |
| `/products/<sku>/handover/` | Record a custody handover |
| `/events/<id>/status/` | Poll TX status (JSON) |
| `/admin/` | Django admin panel |

---

## API Endpoints

### Web / legacy API

| Method | URL | Description |
|---|---|---|
| POST | `/api/events/` | Log an event via JSON (legacy) |

### Mobile API

All mobile endpoints are under `/api/mobile/`. Token auth required on all except login and QR resolve.

**Auth**

| Method | URL | Description |
|---|---|---|
| POST | `/api/mobile/login/` | Email + password → Bearer token |
| GET | `/api/mobile/auth/profile/` | Get current user profile |
| PATCH | `/api/mobile/auth/update-profile/` | Update name and phone |
| POST | `/api/mobile/auth/change-password/` | Change password, invalidates all tokens |
| DELETE | `/api/mobile/auth/sessions/` | Logout from all devices |

**Products & Events**

| Method | URL | Description |
|---|---|---|
| GET | `/api/mobile/products/` | List all products with status and event count |
| POST | `/api/mobile/products/create/` | Create a new product |
| GET | `/api/mobile/events/<sku>/` | Full event history for a product |
| POST | `/api/mobile/log/` | Log a quick event with GPS |
| POST | `/api/mobile/handover/` | Record a full custody handover |
| GET | `/api/mobile/qr/<qr_token>/` | Resolve a scanned QR token to product context |

---

## How It Works

### QR Codes

Every `TrackingEvent` is automatically assigned a unique `qr_token` (UUID hex) when saved. This token is encoded into a QR code URL:

```
https://your-domain.com/api/mobile/qr/<qr_token>/
```

When the mobile app scans this QR it calls the resolve endpoint, gets the product and last event context, and opens the log event screen pre-filled with that product's details. The user selects a status, confirms the GPS-captured location, and submits — which writes a new event to the database and to VeChain.

### GPS Tracking

- **Web:** The browser Geolocation API captures coordinates when a form tab is opened. Coordinates are stored as hidden fields and submitted with the event. Requires HTTPS for non-localhost origins.
- **Mobile:** `expo-location` requests foreground location permission and captures a high-accuracy GPS fix when the log screen mounts. Coordinates are sent directly with the event payload.

GPS coordinates are stored as `latitude` and `longitude` `FloatField`s on `TrackingEvent`. The web UI renders them on a Leaflet map connected by a dashed polyline. The mobile app uses `react-native-maps` with `Marker` and `Polyline` components.

### Custody Handovers

Handovers are a special event type that record a transfer of custody between two named parties. They capture:
- Outgoing and incoming transporter names, roles, and typed signatures
- Quantities dispatched vs received with discrepancy notes
- Handover location, datetime, carrier, vehicle plate, and transport mode
- GPS coordinates of the handover point
- Everything is written to VeChain in a single transaction

### Transaction Status Flow

```
pending → confirmed
       → reverted
       → error (VeChain unreachable)
```

The web UI polls `/events/<id>/status/` via a Refresh button on pending transactions. The mobile app shows the TX status badge on each event in the history screen.

---

## Running Tests

```bash
python manage.py test tracker
```

The test suite covers product and event models, views, and blockchain calls mocked with `unittest.mock` so the full suite runs offline.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please run the test suite before submitting:
```bash
python manage.py test tracker
```

---

## License

This project is developed for educational and demonstration purposes.

---

*Built with Django + VeChain + Expo React Native | TraceBlocks — making supply chains transparent and trustworthy.*