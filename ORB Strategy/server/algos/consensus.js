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
const CONSENSUS_THRESHOLD = 3; // 3 out of 4 must agree

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
	],

	initStockState: () => ({
		lastTradePrice: 0,
		consensus: "Hold",
		confidence: 0,
		algoVotes: "", // e.g., "Buy: ORB, EMA | Sell: VWAP"
		stoploss: 0,
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
		const stoplossLevels = {};

		for (const algo of ALGOS) {
			// Update algo state
			s.algoStates[algo.name] = algo.onTick(s.algoStates[algo.name], tick, currentTime);

			// Extract signal and stoploss
			const algoState = s.algoStates[algo.name];
			signals[algo.name] = algoState.status;
			stoplossLevels[algo.name] = algoState.stoploss || 0;
		}

		// Count votes
		const buyCount = Object.values(signals).filter(sig => sig === "Buy").length;
		const sellCount = Object.values(signals).filter(sig => sig === "Sell").length;

		// Consensus logic
		if (buyCount >= CONSENSUS_THRESHOLD) {
			s.consensus = "Buy";
			s.confidence = Math.round((buyCount / 4) * 100);
			// Median stoploss from Buy-voting algos
			const buySLs = Object.entries(signals)
				.filter(([_, sig]) => sig === "Buy")
				.map(([algo, _]) => stoplossLevels[algo]);
			s.stoploss = median(buySLs);
		} else if (sellCount >= CONSENSUS_THRESHOLD) {
			s.consensus = "Sell";
			s.confidence = Math.round((sellCount / 4) * 100);
			// Median stoploss from Sell-voting algos
			const sellSLs = Object.entries(signals)
				.filter(([_, sig]) => sig === "Sell")
				.map(([algo, _]) => stoplossLevels[algo]);
			s.stoploss = median(sellSLs);
		} else {
			s.consensus = "Hold";
			s.confidence = 0;
			s.stoploss = 0;
		}

		// Format algo votes for display
		s.algoVotes = formatVotes(signals);

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
function formatVotes(signals) {
	const groups = { Buy: [], Sell: [], Hold: [] };
	for (const [algo, sig] of Object.entries(signals)) {
		groups[sig].push(algo);
	}
	return Object.entries(groups)
		.filter(([_, algos]) => algos.length > 0)
		.map(([sig, algos]) => `${sig}: ${algos.join(", ")}`)
		.join(" | ");
}
