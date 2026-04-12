# IntraTrade — Realtime Intraday Signal Dashboard

A live intraday trading signal dashboard for NSE equities, powered by Zerodha Kite Connect WebSocket streams. Screens up to 500 NSE stocks in real time across four independent quantitative strategies and surfaces only the actionable Buy/Sell signals with computed stoploss levels.

---

## Architecture

```
Browser (React)
		│
		│  HTTPS  /api/*              REST — algo list, session, market status
		│  WSS    /socket.io/*        Realtime signal stream
		▼
Traefik (reverse proxy + TLS)
		├──▶ nginx  (React SPA)           :80
		└──▶ Node/Express                 :8001
							│
							│  WebSocket (KiteTicker)
							▼
				 Zerodha Kite Connect
							│  Tick stream (up to 3000 instruments, full mode)
							▼
				 Algo Engine (per-tick, stateful, pure functions)
							│  filtered signals
							▼
				 Socket.IO broadcast  ──▶  Browser live update
```

**Data flow per tick:**
1. KiteTicker emits a raw tick for each subscribed instrument.
2. The active algorithm's `onTick(state, tick, timeIST)` pure function computes the new state.
3. `matchesCriteria(state)` filters to only Buy/Sell signals.
4. The filtered signal set is broadcast over Socket.IO to all connected clients.
5. React re-renders only the changed signal cards.

---

## Features

| Feature | Detail |
|---|---|
| **Realtime tick stream** | Kite WebSocket (full mode) — LTP, OHLC, VWAP, volume per tick |
| **4 swappable strategies** | ORB, VWAP Crossover, Momentum, EMA Crossover |
| **Live algo switching** | Change strategy mid-session without restarting the stream |
| **Dynamic watchlists** | Nifty 50 / Nifty 100 / Nifty 500 symbol sets |
| **Per-signal stoploss** | Each strategy computes its own stoploss level on every tick |
| **Market status detection** | Kite-backed `/api/market/status` — auto-switches UI at market open |
| **Auto-recheck** | Dashboard polls every 30 s; transitions closed→open without refresh |
| **Material dark UI** | MUI v5 dark theme, signal cards with Buy/Sell colour coding |
| **Containerised deploy** | Docker multi-stage build, Traefik TLS, GitHub Actions CI/CD |

---

## Trading Strategies

### 1. Opening Range Breakout (ORB)
Tracks the high and low of every tick during the configurable opening window (default 09:15–09:30).
- **Buy** when price breaks above ORB High; stoploss = ORB Low
- **Sell** when price breaks below ORB Low; stoploss = ORB High

### 2. VWAP Crossover
Uses NSE's intraday VWAP (`average_price` from KiteTicker) as the reference.
- **Buy** when LTP > VWAP + threshold% (default 0.1%)
- **Sell** when LTP < VWAP − threshold%; stoploss = VWAP

### 3. Momentum (% from Day Open)
Measures intraday move from the day's open price (`ohlc.open`).
- **Buy** when change ≥ +threshold% (default 0.5%)
- **Sell** when change ≤ −threshold%; stoploss = day open

### 4. EMA Crossover
Computes two exponential moving averages over successive tick prices using the standard EMA formula, then signals on crossover events.
- **Buy** on short-EMA (default 9) crossing above long-EMA (default 21)
- **Sell** on reverse crossover; stoploss tracks the long-EMA dynamically

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 17, Material UI v5, Socket.IO client, axios |
| Backend | Node.js 20, Express, Socket.IO server, KiteConnect SDK v3 |
| Data | Zerodha Kite Connect WebSocket (KiteTicker) |
| Proxy / TLS | Traefik v2, Let's Encrypt |
| Container | Docker (multi-stage), nginx:alpine |
| CI/CD | GitHub Actions → SSH → Docker Compose |

---

## Repository Layout

```
ORB Strategy/
	dashboard/          React frontend
		src/
			components/     header, home, start, stocks, MarketClosedPage
		Dockerfile        Multi-stage: node build → nginx serve
		nginx.conf
	server/             Node/Express backend
		algos/            orb.js  vwap.js  momentum.js  ema.js  index.js
		controllers/      method.js  (KiteTicker + Socket.IO engine)
		data/             nse_symbols.js  (Nifty 50 / 100 / 500 lists)
		routes/           api.js
		Dockerfile
docker-compose.prod.yml
.env.production.example
.github/workflows/deploy.yml
```

---

## Local Development

### 1) Server

```bash
cd "ORB Strategy/server"
cp .env.example .env          # fill in API_KEY + API_SECRET
npm install
npm start                     # :8001 REST  |  :4001 Socket.IO
```

### 2) Dashboard

```bash
cd "ORB Strategy/dashboard"
cp .env.example .env          # set REACT_APP_KITE_API_KEY
npm install
npm start                     # :3000
```

> Requires a [Zerodha Kite Connect](https://kite.trade/) API key. For development, paste the access token manually in the UI after logging in.

---

## Production Deployment

Source code is cloned into `/opt/projects/intra-trade` on every push. Stack config (compose + env) lives in `/home/ubuntu/stacks/intra-trade` and is never committed to git.

### 1) One-time VM setup

```bash
mkdir -p /home/ubuntu/stacks/intra-trade
# copy docker-compose.prod.yml into it
# create .env.production from .env.production.example with real values
```

### 2) `.env.production` sample

```dotenv
APP_DOMAIN=intra-trade.duckdns.org

# Build-time dashboard config
REACT_APP_API_BASE_URL=https://intra-trade.duckdns.org
REACT_APP_SOCKET_URL=https://intra-trade.duckdns.org
REACT_APP_KITE_API_KEY=your-kite-api-key
REACT_APP_DEFAULT_WATCHLIST=NIFTY50

# Server runtime
PORT=8001
CLIENT_ORIGIN=https://intra-trade.duckdns.org
SOCKET_PORT=4001
MARKET_STATUS_SYMBOL=NSE:NIFTY 50
MARKET_OPEN_TIME=09:15:00
MARKET_CLOSE_TIME=15:30:00

API_KEY=your-kite-api-key
API_SECRET=your-kite-api-secret

WATCHLIST_SIZE=NIFTY50
ORB_START_TIME=09:15:00
ORB_END_TIME=09:30:00
VWAP_THRESHOLD_PCT=0.1
MOMENTUM_THRESHOLD_PCT=0.5
EMA_SHORT_PERIOD=9
EMA_LONG_PERIOD=21
```

### 3) GitHub Secrets & Variables

| Type | Name | Value |
|---|---|---|
| Secret | `VM_HOST` | `<vm-ip>` |
| Secret | `SSH_PRIVATE_KEY` | contents of deploy private key |
| Secret | `VM_HOST_KEY` | output of `ssh-keyscan -H <vm-ip>` |
| Variable | `VM_USER` | `ubuntu` |
| Variable | `DEPLOY_PATH` | `/opt/projects/intra-trade` |
| Variable | `COMPOSE_FILE` | `/home/ubuntu/stacks/intra-trade/docker-compose.prod.yml` |
| Variable | `ENV_FILE` | `/home/ubuntu/stacks/intra-trade/.env.production` |

### 4) Deploy

Push to `master` or `main` — GitHub Actions handles the rest.

```bash
git push origin master
```

Traefik routes on `intra-trade.duckdns.org`:
- `/api/*`, `/health` → Node API (:8001)
- `/socket.io/*` → Socket.IO (:4001)
- everything else → React SPA (:80)
