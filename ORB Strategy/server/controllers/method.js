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
const ORB_START_TIME = process.env.ORB_START_TIME || "09:15:00";
const ORB_END_TIME = process.env.ORB_END_TIME || "09:30:00";
const ORB_BOOTSTRAP_CONCURRENCY = Number(process.env.ORB_BOOTSTRAP_CONCURRENCY || 8);

// ─── Runtime state ────────────────────────────────────────────────────────────
let io;
let socketServer;
let socketBootstrapped = false;

let ticker;
let activeAccessToken = null;
let hasLoggedQuotePermissionWarning = false;

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

function getErrorMessage(err, fallback = "unknown_error") {
	return (
		err?.message ||
		err?.error_type ||
		err?.response?.data?.message ||
		err?.response?.data?.error ||
		fallback
	);
}

function isPermissionErrorMessage(message = "") {
	const lower = String(message).toLowerCase();
	return lower.includes("insufficient permission") || lower.includes("permission for that call");
}

function isForbiddenSocketError(err) {
	const message = String(err?.message || err || "").toLowerCase();
	return message.includes("403") || message.includes("forbidden");
}

function algoNeedsORBBootstrap(algoName) {
	return algoName === "ORB" || algoName === "CONSENSUS";
}

function getOrbStateForToken(token) {
	const rootState = stockState[token];
	if (!rootState) return null;

	if (activeAlgo.name === "ORB") return rootState;
	if (activeAlgo.name === "CONSENSUS") return rootState?.algoStates?.ORB || null;

	return null;
}

function extractOrbRange(candles) {
	if (!Array.isArray(candles) || candles.length === 0) return null;

	let high = -Infinity;
	let low = Infinity;

	for (const candle of candles) {
		const candleHigh = Number(candle?.high);
		const candleLow = Number(candle?.low);
		if (!Number.isFinite(candleHigh) || !Number.isFinite(candleLow)) continue;
		high = Math.max(high, candleHigh);
		low = Math.min(low, candleLow);
	}

	if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
	return { high, low };
}

async function bootstrapORBFromHistory(kc, tokens) {
	if (!algoNeedsORBBootstrap(activeAlgo.name)) return;

	const { currentTime, isWeekend } = isTradingHoursNow();
	if (isWeekend || currentTime <= ORB_END_TIME) return;

	const dateIST = formatDateInIndia();
	const from = `${dateIST} ${ORB_START_TIME}`;
	const to = `${dateIST} ${ORB_END_TIME}`;

	const pendingTokens = (tokens || []).filter((token) => {
		const orbState = getOrbStateForToken(token);
		if (!orbState) return false;
		return orbState.orbHigh === null || orbState.orbLow === null;
	});

	if (pendingTokens.length === 0) return;

	let applied = 0;
	let failed = 0;

	for (let i = 0; i < pendingTokens.length; i += ORB_BOOTSTRAP_CONCURRENCY) {
		const chunk = pendingTokens.slice(i, i + ORB_BOOTSTRAP_CONCURRENCY);
		await Promise.all(
			chunk.map(async (token) => {
				try {
					const candles = await kc.getHistoricalData(token, "minute", from, to, false);
					const range = extractOrbRange(candles);
					if (!range) return;

					const orbState = getOrbStateForToken(token);
					if (!orbState) return;

					orbState.orbHigh = range.high;
					orbState.orbLow = range.low;
					applied += 1;
				} catch (_err) {
					failed += 1;
				}
			})
		);
	}

	if (applied > 0) {
		console.log(`ORB bootstrap applied for ${applied}/${pendingTokens.length} symbols (${from} → ${to})`);
		if (io) io.emit("FromAPI", buildBroadcastPayload());
	}

	if (applied === 0 && failed > 0) {
		console.warn("ORB bootstrap could not populate ranges from historical candles.");
	}
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
	const symbolSet   = new Set(symbols);
	const nsePrefixed = symbols.map((s) => `NSE:${s}`);
	const BATCH_SIZE  = 500;
	const merged      = {};

	try {
		const instruments = await kc.getInstruments("NSE");
		const map = {};

		for (const item of instruments || []) {
			const symbol = item?.tradingsymbol;
			const token = Number(item?.instrument_token);
			if (!symbolSet.has(symbol)) continue;
			if (!Number.isFinite(token)) continue;
			map[token] = symbol;
		}

		const tokens = Object.keys(map).map(Number);
		if (tokens.length > 0) {
			return { tokenToName: map, tokens };
		}
	} catch (err) {
		console.warn("getInstruments fallback failed:", getErrorMessage(err));
	}

	let sawPermissionError = false;

	for (let i = 0; i < nsePrefixed.length; i += BATCH_SIZE) {
		const batch = nsePrefixed.slice(i, i + BATCH_SIZE);
		try {
			const result = await kc.getLTP(batch);
			Object.assign(merged, result);
		} catch (err) {
			const message = getErrorMessage(err);
			if (isPermissionErrorMessage(message)) sawPermissionError = true;
			console.warn(`getLTP batch ${i}–${i + BATCH_SIZE} failed:`, message);
		}
	}

	const map = {};
	for (const [key, value] of Object.entries(merged)) {
		map[value.instrument_token] = key.replace("NSE:", "");
	}

	const tokens = Object.keys(map).map(Number);
	if (tokens.length === 0 && sawPermissionError) {
		throw new Error("Insufficient permission for quote/LTP APIs. Enable market quote access for this Kite Connect app.");
	}

	return {
		tokenToName: map,
		tokens,
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
		updatedAtMs: Date.now(),
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
	ticker.on("error",        (err) => {
		if (isForbiddenSocketError(err)) {
			console.error("Ticker auth/permission error (403). Stopping reconnect attempts. Re-login to refresh access token and verify Kite app permissions.");
			try { ticker.autoReconnect(false); } catch (_e) {}
			try { ticker.disconnect(); } catch (_e) {}
			activeAccessToken = null;
			return;
		}
		console.error("Ticker error:", err?.message || err);
	});

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
		const message = getErrorMessage(err, "Unable to generate access token");
		console.error("Session generation failed:", message);
		return res.status(401).json({ error: message });
	}
};

module.exports.kiteLoginUrl = (_req, res) => {
	if (!API_KEY)
		return res.status(500).json({ error: "Kite API key not configured on server" });

	try {
		const kc = new KiteConnect({ api_key: API_KEY });
		return res.status(200).json({ loginUrl: kc.getLoginURL() });
	} catch (err) {
		console.error("Unable to generate Kite login URL:", err?.message || err);
		return res.status(500).json({ error: "Unable to generate Kite login URL" });
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

		// Validate access token before doing expensive symbol resolution / WS connect.
		try {
			await kc.getProfile();
		} catch (authErr) {
			const authMessage = getErrorMessage(authErr, "Access token invalid or expired");
			return res.status(401).json({
				error: `Access token validation failed: ${authMessage}. Please login with Kite again.`,
			});
		}

		const { tokenToName: resolved, tokens } = await resolveInstrumentTokens(kc);

		if (tokens.length === 0)
			return res.status(502).json({
				error: "Could not resolve any instrument tokens from Kite getLTP",
			});

		tokenToName = resolved;
		const started = startTicker(accessToken, tokens);

		if (algoNeedsORBBootstrap(activeAlgo.name)) {
			bootstrapORBFromHistory(kc, tokens).catch((err) => {
				console.warn("ORB bootstrap failed:", getErrorMessage(err));
			});
		}

		return res.status(200).json({
			status:      started ? "started" : "already_running",
			algo:        activeAlgo.name,
			algoLabel:   activeAlgo.label,
			instruments: tokens.length,
			socketPort:  SOCKET_PORT,
		});
	} catch (err) {
		const message = getErrorMessage(err, "Unable to start market data stream");
		console.error("Stream start failed:", message);
		const statusCode = isPermissionErrorMessage(message) ? 403 : 500;
		return res.status(statusCode).json({ error: message });
	}
};

module.exports.setAlgo = async (req, res) => {
	const algoName  = ((req.body?.algo || "") + "").toUpperCase();
	const requested = getAlgo(algoName);

	activeAlgo = requested;
	resetStockState();
	console.log(`Algo switched to ${activeAlgo.name}`);

	if (algoNeedsORBBootstrap(activeAlgo.name) && activeAccessToken && subscribedTokens.length > 0) {
		try {
			const kc = new KiteConnect({ api_key: API_KEY, access_token: activeAccessToken });
			await bootstrapORBFromHistory(kc, subscribedTokens);
		} catch (err) {
			console.warn("ORB bootstrap on algo switch failed:", getErrorMessage(err));
		}
	}

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

	res.set({
		"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
		Pragma: "no-cache",
		Expires: "0",
		"Surrogate-Control": "no-store",
	});

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
		const hasLiveQuoteData = Boolean(
			quote && (
				typeof quote.last_price === "number" ||
				quote.ohlc ||
				quote.net_change !== undefined
			)
		);
		const quoteDateIST = quoteTimestamp
			? formatDateInIndia(quoteTimestamp instanceof Date ? quoteTimestamp : new Date(quoteTimestamp))
			: null;
		const todayIST = formatDateInIndia();
		const isQuoteFreshToday = Boolean(quoteDateIST && quoteDateIST === todayIST);
		const usedScheduleFallback = inTradingHours && hasLiveQuoteData && !quoteTimestamp;
		const open = inTradingHours && (isQuoteFreshToday || usedScheduleFallback);

		return res.status(200).json({
			open,
			source: usedScheduleFallback ? "schedule_with_quote_presence" : "kite_quote",
			symbol: MARKET_STATUS_SYMBOL,
			isWeekend,
			inTradingHours,
			isQuoteFreshToday,
			hasLiveQuoteData,
			usedScheduleFallback,
			currentTime,
			quoteTime: formatDateTimeInIndia(quoteTimestamp),
			marketOpenTime: MARKET_OPEN_TIME,
			marketCloseTime: MARKET_CLOSE_TIME,
		});
	} catch (err) {
		const message = getErrorMessage(err);
		if (isPermissionErrorMessage(message)) {
			if (!hasLoggedQuotePermissionWarning) {
				console.warn("Kite market status quote check permission denied. Falling back to schedule-based status.");
				hasLoggedQuotePermissionWarning = true;
			}
		} else {
			console.error("Kite market status check failed:", message);
		}
		return res.status(200).json({
			open: inTradingHours,
			source: "schedule_fallback",
			reason: "Kite quote lookup failed",
			error: message,
			isWeekend,
			currentTime,
			marketOpenTime: MARKET_OPEN_TIME,
			marketCloseTime: MARKET_CLOSE_TIME,
		});
	}
};

// backward compat alias
module.exports.getData = module.exports.startStream;
