// @ts-nocheck
const { KiteConnect, KiteTicker } = require("kiteconnect");
const http = require("http");
const { Server } = require("socket.io");

const { getSymbolList } = require("../data/nse_symbols");
const { getAlgo, getAlgoList, DEFAULT_ALGO } = require("../algos/index");

// ─── Configuration ────────────────────────────────────────────────────────────
const API_KEY       = process.env.API_KEY;
const API_SECRET    = process.env.API_SECRET;
const SOCKET_PORT   = Number(process.env.SOCKET_PORT   || 4001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN        || "http://localhost:3000";
const WATCHLIST     = process.env.WATCHLIST_SIZE       || "NIFTY50";
const MARKET_STATUS_SYMBOL = process.env.MARKET_STATUS_SYMBOL || "NSE:NIFTY 50";
const MARKET_OPEN_TIME = process.env.MARKET_OPEN_TIME || "09:15:00";
const MARKET_CLOSE_TIME = process.env.MARKET_CLOSE_TIME || "15:30:00";

// ─── Runtime state ────────────────────────────────────────────────────────────
let io;
let socketServer;
let socketBootstrapped = false;

let ticker;
let activeAccessToken = null;

/**
 * tokenToName  { [instrumentToken]: string }  maps token → trading symbol
 * stockState   { [instrumentToken]: object }  per-algo state per stock
 */
let tokenToName      = {};
let stockState       = {};
let subscribedTokens = [];

/** Active algorithm module (default: ORB) */
let activeAlgo = getAlgo(DEFAULT_ALGO);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTimeInIndia() {
	return new Date().toLocaleTimeString("en-GB", {
		hour12: false,
		timeZone: "Asia/Kolkata",
	});
}

function formatDateInIndia(date = new Date()) {
	return date.toLocaleDateString("en-CA", {
		timeZone: "Asia/Kolkata",
	});
}

function formatDateTimeInIndia(date) {
	if (!date) return null;
	const value = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(value.getTime())) return null;
	return value.toLocaleString("en-GB", {
		hour12: false,
		timeZone: "Asia/Kolkata",
	});
}

function isTradingHoursNow() {
	const now = new Date();
	const currentTime = now.toLocaleTimeString("en-GB", {
		hour12: false,
		timeZone: "Asia/Kolkata",
	});
	const weekday = now.toLocaleDateString("en-US", {
		weekday: "short",
		timeZone: "Asia/Kolkata",
	});
	const isWeekend = weekday === "Sat" || weekday === "Sun";

	return {
		isWeekend,
		currentTime,
		inTradingHours:
			!isWeekend && currentTime >= MARKET_OPEN_TIME && currentTime <= MARKET_CLOSE_TIME,
	};
}

/**
 * Resolve NSE symbols → instrument tokens using kite.getLTP().
 * getLTP returns { "NSE:SYMBOL": { instrument_token, last_price, … } }.
 * Batched in groups of 500 to stay within API limits.
 *
 * @param {object} kc  Authenticated KiteConnect instance
 * @returns {{ tokenToName: object, tokens: number[] }}
 */
async function resolveInstrumentTokens(kc) {
	const symbols     = getSymbolList(WATCHLIST);
	const nsePrefixed = symbols.map((s) => `NSE:${s}`);
	const BATCH_SIZE  = 500;
	const merged      = {};

	for (let i = 0; i < nsePrefixed.length; i += BATCH_SIZE) {
		const batch = nsePrefixed.slice(i, i + BATCH_SIZE);
		try {
			const result = await kc.getLTP(batch);
			Object.assign(merged, result);
		} catch (err) {
			console.warn(`getLTP batch ${i}–${i + BATCH_SIZE} failed:`, err.message);
		}
	}

	const map = {};
	for (const [key, value] of Object.entries(merged)) {
		map[value.instrument_token] = key.replace("NSE:", "");
	}

	return {
		tokenToName: map,
		tokens: Object.keys(map).map(Number),
	};
}

// ─── Socket server (singleton) ────────────────────────────────────────────────
function ensureSocketServer() {
	if (socketBootstrapped) return;

	socketServer = http.createServer();
	io = new Server(socketServer, {
		cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
	});

	io.on("connection", (socket) => {
		console.log("Socket client connected:", socket.id);
		socket.emit("FromAPI", buildBroadcastPayload());
		socket.on("disconnect", () =>
			console.log("Socket client disconnected:", socket.id)
		);
	});

	socketServer.listen(SOCKET_PORT, () =>
		console.log(`Socket server listening on port ${SOCKET_PORT}`)
	);

	socketBootstrapped = true;
}

// ─── Tick processor ───────────────────────────────────────────────────────────

/**
 * Builds the socket payload: only stocks matching the active algo's criteria.
 * Payload shape: { algo, algoLabel, signals, total, matched, updatedAt }
 */
function buildBroadcastPayload() {
	const signals = [];

	for (const [token, state] of Object.entries(stockState)) {
		if (activeAlgo.matchesCriteria(state)) {
			signals.push({
				name: tokenToName[token] || `Token:${token}`,
				...state,
			});
		}
	}

	// Buy signals first, then Sell, then alphabetical within each group
	signals.sort((a, b) => {
		const ORDER = { Buy: 0, Sell: 1 };
		const diff  = (ORDER[a.status] ?? 2) - (ORDER[b.status] ?? 2);
		return diff !== 0 ? diff : a.name.localeCompare(b.name);
	});

	return {
		algo:      activeAlgo.name,
		algoLabel: activeAlgo.label,
		signals,
		total:     subscribedTokens.length,
		matched:   signals.length,
		updatedAt: formatTimeInIndia(),
	};
}

function processTicks(ticks) {
	const currentTime = formatTimeInIndia();

	for (const tick of ticks) {
		const token = tick.instrument_token;
		if (!stockState[token]) continue;
		stockState[token] = activeAlgo.onTick(stockState[token], tick, currentTime);
	}

	if (io) io.emit("FromAPI", buildBroadcastPayload());
}

// ─── Ticker lifecycle ─────────────────────────────────────────────────────────
function stopExistingTicker() {
	if (!ticker) return;
	try {
		ticker.disconnect();
	} catch (err) {
		console.error("Error disconnecting ticker:", err.message);
	}
	ticker = null;
	activeAccessToken = null;
}

function resetStockState() {
	const fresh = {};
	for (const token of subscribedTokens) {
		fresh[token] = activeAlgo.initStockState();
	}
	stockState = fresh;
}

/**
 * Start the KiteTicker for the given access token.
 * @param {string} accessToken
 * @param {number[]} tokens
 * @returns {boolean}  true = newly started, false = already running same token
 */
function startTicker(accessToken, tokens) {
	if (!API_KEY) throw new Error("API_KEY is not configured on server");

	if (ticker && activeAccessToken === accessToken) return false;

	stopExistingTicker();
	subscribedTokens = tokens;
	resetStockState();

	ticker = new KiteTicker({ api_key: API_KEY, access_token: accessToken });
	ticker.autoReconnect(true, 10, 5);

	ticker.on("ticks",        processTicks);
	ticker.on("connect",      () => {
		ticker.subscribe(tokens);
		ticker.setMode(ticker.modeFull, tokens);
		console.log(`Ticker connected: subscribing to ${tokens.length} instruments`);
	});
	ticker.on("disconnect",   () => console.log("Ticker disconnected"));
	ticker.on("reconnecting", (int, att) => console.log("Ticker reconnecting", { att, int }));
	ticker.on("error",        (err) => console.error("Ticker error:", err?.message || err));

	ticker.connect();
	activeAccessToken = accessToken;
	return true;
}

// ─── Exported controllers ─────────────────────────────────────────────────────
module.exports.login = async (req, res) => {
	const requestToken = (req.body?.requestToken || "").trim();
	if (!requestToken)
		return res.status(400).json({ error: "requestToken is required" });
	if (!API_KEY || !API_SECRET)
		return res.status(500).json({ error: "API credentials not configured on server" });

	try {
		const kc      = new KiteConnect({ api_key: API_KEY });
		const session = await kc.generateSession(requestToken, API_SECRET);
		return res.status(200).json({ accessToken: session?.access_token });
	} catch (err) {
		console.error("Session generation failed:", err?.message || err);
		return res.status(401).json({ error: "Unable to generate access token" });
	}
};

module.exports.startStream = async (req, res) => {
	const accessToken = (req.body?.accessToken || "").trim();
	const algoName    = ((req.body?.algo || DEFAULT_ALGO) + "").toUpperCase();

	if (!accessToken)
		return res.status(400).json({ error: "accessToken is required" });

	// Switch algo if requested (can happen without restarting the ticker)
	const requestedAlgo = getAlgo(algoName);
	if (requestedAlgo.name !== activeAlgo.name) {
		activeAlgo = requestedAlgo;
		resetStockState();
		console.log(`Algo switched to ${activeAlgo.name}`);
	}

	try {
		ensureSocketServer();

		const kc = new KiteConnect({ api_key: API_KEY, access_token: accessToken });
		const { tokenToName: resolved, tokens } = await resolveInstrumentTokens(kc);

		if (tokens.length === 0)
			return res.status(502).json({
				error: "Could not resolve any instrument tokens from Kite getLTP",
			});

		tokenToName = resolved;
		const started = startTicker(accessToken, tokens);

		return res.status(200).json({
			status:      started ? "started" : "already_running",
			algo:        activeAlgo.name,
			algoLabel:   activeAlgo.label,
			instruments: tokens.length,
			socketPort:  SOCKET_PORT,
		});
	} catch (err) {
		console.error("Stream start failed:", err?.message || err);
		return res.status(500).json({ error: "Unable to start market data stream" });
	}
};

module.exports.setAlgo = (req, res) => {
	const algoName  = ((req.body?.algo || "") + "").toUpperCase();
	const requested = getAlgo(algoName);

	activeAlgo = requested;
	resetStockState();
	console.log(`Algo switched to ${activeAlgo.name}`);

	if (io) io.emit("FromAPI", buildBroadcastPayload());

	return res.status(200).json({
		algo:      activeAlgo.name,
		algoLabel: activeAlgo.label,
	});
};

module.exports.streamHealth = (_req, res) => {
	return res.status(200).json({
		socketServerStarted: socketBootstrapped,
		streamActive:        Boolean(ticker),
		activeAlgo:          activeAlgo.name,
		instruments:         subscribedTokens.length,
		socketPort:          SOCKET_PORT,
	});
};

module.exports.listAlgos = (_req, res) => {
	return res.status(200).json(getAlgoList());
};

module.exports.marketStatus = async (req, res) => {
	const tokenFromQuery = (req.query?.accessToken || "").trim();
	const tokenFromBody = (req.body?.accessToken || "").trim();
	const accessToken = tokenFromQuery || tokenFromBody || activeAccessToken || "";
	const { inTradingHours, isWeekend, currentTime } = isTradingHoursNow();

	if (!accessToken) {
		return res.status(200).json({
			open: inTradingHours,
			source: "schedule_fallback",
			reason: "No access token available for Kite quote check",
			isWeekend,
			currentTime,
			marketOpenTime: MARKET_OPEN_TIME,
			marketCloseTime: MARKET_CLOSE_TIME,
		});
	}

	try {
		const kc = new KiteConnect({ api_key: API_KEY, access_token: accessToken });
		const quoteResponse = await kc.getQuote([MARKET_STATUS_SYMBOL]);
		const quote = quoteResponse?.[MARKET_STATUS_SYMBOL] || null;
		const quoteTimestamp = quote?.timestamp || quote?.last_trade_time || null;
		const quoteDateIST = quoteTimestamp
			? formatDateInIndia(quoteTimestamp instanceof Date ? quoteTimestamp : new Date(quoteTimestamp))
			: null;
		const todayIST = formatDateInIndia();
		const isQuoteFreshToday = Boolean(quoteDateIST && quoteDateIST === todayIST);
		const open = inTradingHours && isQuoteFreshToday;

		return res.status(200).json({
			open,
			source: "kite_quote",
			symbol: MARKET_STATUS_SYMBOL,
			isWeekend,
			inTradingHours,
			isQuoteFreshToday,
			currentTime,
			quoteTime: formatDateTimeInIndia(quoteTimestamp),
			marketOpenTime: MARKET_OPEN_TIME,
			marketCloseTime: MARKET_CLOSE_TIME,
		});
	} catch (err) {
		console.error("Kite market status check failed:", err?.message || err);
		return res.status(200).json({
			open: inTradingHours,
			source: "schedule_fallback",
			reason: "Kite quote lookup failed",
			error: err?.message || "unknown_error",
			isWeekend,
			currentTime,
			marketOpenTime: MARKET_OPEN_TIME,
			marketCloseTime: MARKET_CLOSE_TIME,
		});
	}
};

// backward compat alias
module.exports.getData = module.exports.startStream;
