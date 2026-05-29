# trace-blocks
# TraceBlocks

> A blockchain-powered supply chain traceability system built on Django and VeChain.

TraceBlocks enables vendors, manufacturers, and logistics handlers to record every step of a product's journey — from origin to consumer — on an immutable public ledger. Every checkpoint is stored both in a local Django database for fast querying and on the VeChain blockchain for tamper-proof verification.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Blockchain Integration](#blockchain-integration)
- [Smart Contract](#smart-contract)
- [Running the App](#running-the-app)
- [Running Tests](#running-tests)
- [Environment Variables](#environment-variables)
- [How It Works](#how-it-works)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)

---

## Overview

Traditional supply chain systems rely on centralised databases controlled by a single party. This means records can be altered, deleted, or backdated — making it impossible for consumers, regulators, or auditors to independently verify a product's history.

TraceBlocks solves this by writing every tracking event to the **VeChain blockchain** at the moment it is recorded. Once written, the data is permanent and publicly verifiable — no party, including the system owner, can change it.

The Django backend handles all business logic, authentication, fast database queries, and the user interface. VeChain acts as an immutable audit trail — a tamper-proof receipt for every event that occurs.

---

## Features

- Register products with SKU, manufacturer, and description
- Record tracking events at every checkpoint (manufactured → shipped → in transit → at hub → out for delivery → delivered)
- Every event is written to the VeChain testnet blockchain with a transaction ID
- Live transaction status polling — pending, confirmed, reverted, or error
- Blockchain explorer links for every recorded event
- Graceful degradation — if VeChain is unreachable, events are saved locally with `tx_status: error` and the app keeps working
- Django admin panel for full data visibility
- Clean, responsive HTML interface

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, Django |
| Database | SQLite (development) |
| Blockchain | VeChain (Thor protocol) |
| Blockchain SDK | thor-requests (Python) |
| Contract Compiler | Remix Ethereum IDE |
| Wallet | VeWorld browser extension |
| Version Control | Git / GitHub |

---

## Project Structure

```
trace-blocks/
├── traceblocks/                  ← Django project config
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
│
├── tracker/                      ← Main Django app
│   ├── models.py                 ← Product, TrackingEvent models
│   ├── views.py                  ← All view logic + blockchain calls
│   ├── urls.py                   ← URL routing
│   ├── admin.py                  ← Django admin registration
│   ├── tests.py                  ← Full test suite
│   ├── blockchain.py             ← VeChainService class
│   |
│   |
│   |
│   │
│   └── templates/
│       ├── index.html            ← Product list + registration
│       ├── product_detail.html   ← Product journey + add event
│       ├── interface.html        ← User dashboard
│       └── login.html            ← Authentication
│
├── deploy.py                     ← One-time contract deployment script
├── manage.py
├── requirements.txt
└── .env                          ← Environment variables (never commit)
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
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up environment variables

Create a `.env` file at the project root:

```
VECHAIN_NODE_URL=https://testnet.veblocks.net
CONTRACT_ADDRESS=0xYourDeployedContractAddress
DEPLOYER_PRIVATE_KEY=your_veworld_private_key_here
```

See [Environment Variables](#environment-variables) for details.

### 5. Run migrations

```bash
python manage.py migrate
```

### 6. Create a superuser (optional, for admin panel)

```bash
python manage.py createsuperuser
```

### 7. Run the development server

```bash
python manage.py runserver
```

Visit `http://127.0.0.1:8000` in your browser.

---

## Blockchain Integration

TraceBlocks uses a **hybrid architecture**:

- **Django DB** — stores all data locally for fast queries and UI rendering
- **VeChain** — receives every tracking event at the moment it is created, producing a permanent on-chain record

When a tracking event is added:

1. Django saves the event to the local database immediately
2. `VeChainService` broadcasts the event to the VeChain testnet
3. The returned transaction ID is saved to the event record
4. `tx_status` starts as `pending` and can be polled until `confirmed`
5. If VeChain is unreachable, `tx_status` is set to `error` and the app continues normally

This means the app is always functional even without a blockchain connection, while still providing full on-chain verification when available.

---

**Source:** `tracker/contracts/TraceBlocks.sol`


### Compiling and Deploying

1. Open [remix.ethereum.org](https://remix.ethereum.org)
2. Create `TraceBlocks.sol` and paste the contract code
3. Compile with Solidity compiler version `0.8.x`
4. Copy the generated **ABI** and **Bytecode** into `tracker/contracts/TraceBlocks.json`
5. Run the deployment script:

```bash
python deploy.py
```

6. Copy the deployed contract address from the VeChain testnet explorer and add it to your `.env`

### Verifying on the Explorer

Every transaction can be verified at:
```
https://explore-testnet.vechain.org/transactions/<tx_id>
```

---

## Running the App

```bash
# Activate virtual environment
source venv/bin/activate

# Start the server
python manage.py runserver
```

| URL | Description |
|---|---|
| `/` | Product list and registration |
| `/products/<sku>/` | Product detail and event history |
| `/products/new/` | Register a new product |
| `/products/<sku>/events/` | Add a tracking event |
| `/events/<id>/status/` | Poll transaction status (JSON) |
| `/admin/` | Django admin panel |

---

## Running Tests

```bash
python manage.py test tracker
```

The test suite covers:

- **Product model** — creation, unique SKU constraint, `current_status()` method
- **TrackingEvent model** — creation, string representation, explorer URL generation, ordering
- **Views** — index, product detail, 404 handling
- **Blockchain** — mocked VeChain calls to test both success and failure paths without a real network connection

Blockchain tests use `unittest.mock` so the full suite runs offline without any VeChain connection.

---

## Environment Variables

| Variable | Description |
|---|---|
| `VECHAIN_NODE_URL` | VeChain node URL. Use `https://testnet.veblocks.net` for development |
| `CONTRACT_ADDRESS` | Address of the deployed TraceBlocks smart contract |
| `DEPLOYER_PRIVATE_KEY` | Private key of the VeWorld wallet used to sign transactions |

**Never commit your `.env` file.** Add it to `.gitignore`:

```bash
echo ".env" >> .gitignore
```

---

## How It Works

### Product Registration

When a product is registered:

1. A `Product` record is created in Django with name, SKU, manufacturer, and description
2. An initial `TrackingEvent` with status `manufactured` is automatically created
3. This event is immediately broadcast to VeChain via `VeChainService`
4. The product appears in the list with its current status badge

### Adding a Checkpoint

When a handler records a checkpoint (e.g. "Received at Nairobi Warehouse"):

1. The view receives `status`, `location`, and `notes` from the form
2. `_log_event()` creates a `TrackingEvent` in the database
3. `VeChainService.record_tracking_event()` sends the event to the smart contract
4. The transaction ID is stored on the event record
5. The UI shows the TX ID with a link to the blockchain explorer

### Transaction Status

Transactions on VeChain are not instant. The status flow is:

```
pending → confirmed
       → reverted
       → error (if VeChain was unreachable)
```

The `/events/<id>/status/` endpoint can be polled via AJAX to update the UI when a transaction confirms.

---

## API Endpoints

| Method | URL | Description |
|---|---|---|
| GET | `/` | List all products |
| POST | `/products/new/` | Register a new product |
| GET | `/products/<sku>/` | Product detail and event timeline |
| POST | `/products/<sku>/events/` | Add a tracking event |
| GET | `/events/<id>/status/` | Get TX status as JSON |

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

*Built with Django + VeChain | TraceBlocks — making supply chains transparent and trustworthy.*