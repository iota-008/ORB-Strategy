// @ts-nocheck
/**
 * CONSENSUS – Multi-algo agreement-based signal
 *
 * Logic:
 *  - Runs all 4 algos (ORB, VWAP, Momentum, EMA) on each tick.
 *  - Signal BUY  if 3+ algos agree on Buy.
 *  - Signal SELL if 3+ algos agree on Sell.
 *  - Otherwise Hold.
 *  - Stoploss is the median of stoploss levels from agreeing algos.
 *  - Confidence = (count of agreeing algos) / 4.
 *
 * Extra display fields: algoVotes, confidence
 */

const orb = require("./orb");
const vwap = require("./vwap");
const momentum = require("./momentum");
const ema = require("./ema");

const ALGOS = [orb, vwap, momentum, ema];
const CONSENSUS_RATIO = Number(process.env.CONSENSUS_RATIO || 0.75); // default 75% agreement
const TARGET_RR = Number(process.env.CONSENSUS_TARGET_RR || 2); // reward:risk multiplier
const ORB_END_TIME = process.env.ORB_END_TIME || "09:30:00";

module.exports = {
	name: "CONSENSUS",
	label: "Consensus (3+ Algos)",
	description:
		"Signals only when 3 or more algos agree on Buy/Sell. Higher conviction, fewer false signals.",

	extraFields: [
		{ key: "lastTradePrice", label: "LTP" },
		{ key: "consensus", label: "Consensus" },
		{ key: "confidence", label: "Confidence %" },
		{ key: "algoVotes", label: "Algo Votes" },
		{ key: "stoploss", label: "Stoploss (Median)" },
		{ key: "target", label: "Target" },
	],

	initStockState: () => ({
		lastTradePrice: 0,
		consensus: "Hold",
		confidence: 0,
		algoVotes: "", // e.g., "Buy: ORB, EMA | Sell: VWAP"
		stoploss: 0,
		target: 0,
		// Internal state for each algo
		algoStates: {
			ORB: orb.initStockState(),
			VWAP: vwap.initStockState(),
			Momentum: momentum.initStockState(),
			EMA: ema.initStockState(),
		},
	}),

	onTick(state, tick, currentTime) {
		const s = { ...state };
		const price = tick.last_price;
		s.lastTradePrice = price;

		// Run each algo's onTick
		const signals = {};
		const unavailable = [];
		const stoplossLevels = {};

		for (const algo of ALGOS) {
			// Update algo state
			s.algoStates[algo.name] = algo.onTick(s.algoStates[algo.name], tick, currentTime);

			// Extract signal and stoploss
			const algoState = s.algoStates[algo.name];
			if (isAlgoUnavailable(algo.name, algoState, currentTime)) {
				unavailable.push(algo.name);
				continue;
			}
			signals[algo.name] = algoState.status;
			stoplossLevels[algo.name] = algoState.stoploss || 0;
		}

		// Count votes
		const buyCount = Object.values(signals).filter(sig => sig === "Buy").length;
		const sellCount = Object.values(signals).filter(sig => sig === "Sell").length;
		const activeAlgos = Object.keys(signals).length;
		const threshold = getConsensusThreshold(activeAlgos);

		// Consensus logic
		if (activeAlgos > 0 && buyCount >= threshold) {
			s.consensus = "Buy";
			s.confidence = Math.round((buyCount / activeAlgos) * 100);
			// Median stoploss from Buy-voting algos
			const buySLs = Object.entries(signals)
				.filter(([_, sig]) => sig === "Buy")
				.map(([algo, _]) => stoplossLevels[algo]);
			s.stoploss = median(buySLs);
			s.target = computeTarget("Buy", price, s.stoploss);
		} else if (activeAlgos > 0 && sellCount >= threshold) {
			s.consensus = "Sell";
			s.confidence = Math.round((sellCount / activeAlgos) * 100);
			// Median stoploss from Sell-voting algos
			const sellSLs = Object.entries(signals)
				.filter(([_, sig]) => sig === "Sell")
				.map(([algo, _]) => stoplossLevels[algo]);
			s.stoploss = median(sellSLs);
			s.target = computeTarget("Sell", price, s.stoploss);
		} else {
			s.consensus = "Hold";
			s.confidence = 0;
			s.stoploss = 0;
			s.target = 0;
		}

		// Format algo votes for display
		s.algoVotes = formatVotes(signals, unavailable, threshold);

		return s;
	},

	matchesCriteria: (state) => state.consensus === "Buy" || state.consensus === "Sell",
};

/**
 * Helper: Calculate median of array
 */
function median(arr) {
	if (!arr || arr.length === 0) return 0;
	const sorted = [...arr].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0
		? sorted[mid]
		: (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Helper: Format votes string for display
 * e.g., "Buy: ORB, EMA | Sell: VWAP | Hold: Momentum"
 */
function formatVotes(signals, unavailable = [], threshold = 0) {
	const groups = { Buy: [], Sell: [], Hold: [] };
	for (const [algo, sig] of Object.entries(signals)) {
		groups[sig].push(algo);
	}
	const parts = Object.entries(groups)
		.filter(([_, algos]) => algos.length > 0)
		.map(([sig, algos]) => `${sig}: ${algos.join(", ")}`)
		.join(" | ");

	const extras = [];
	if (threshold > 0) extras.push(`Need: ${threshold} agree`);
	if (unavailable.length > 0) extras.push(`Unavailable: ${unavailable.join(", ")}`);

	return [parts, ...extras].filter(Boolean).join(" | ");
}

function getConsensusThreshold(activeCount) {
	if (activeCount <= 0) return 0;
	return Math.max(2, Math.ceil(activeCount * CONSENSUS_RATIO));
}

function isAlgoUnavailable(algoName, algoState, currentTime) {
	if (algoName !== "ORB") return false;
	const orbRangeMissing = algoState?.orbHigh === null || algoState?.orbLow === null;
	return currentTime > ORB_END_TIME && orbRangeMissing;
}

function computeTarget(signal, entryPrice, stoploss) {
	if (!entryPrice || !stoploss) return 0;
	const risk = Math.abs(entryPrice - stoploss);
	if (!risk) return 0;

	if (signal === "Buy") {
		if (stoploss >= entryPrice) return 0;
		return Math.round((entryPrice + risk * TARGET_RR) * 100) / 100;
	}

	if (signal === "Sell") {
		if (stoploss <= entryPrice) return 0;
		return Math.round((entryPrice - risk * TARGET_RR) * 100) / 100;
	}

	return 0;
}
