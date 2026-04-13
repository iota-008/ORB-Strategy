// @ts-nocheck
/**
 * VWAP – Volume Weighted Average Price Crossover
 *
 * Logic:
 *  - KiteTicker (full mode) provides `average_price` which is the daily VWAP
 *    as calculated by NSE (cumulative traded value / cumulative volume).
 *  - Signal BUY  when last_price is > VWAP + threshold (default 0.1 %).
 *  - Signal SELL when last_price is < VWAP - threshold (default 0.1 %).
 *
 * Extra display fields: vwap, diffPct
 *
 * Env vars:
 *   VWAP_THRESHOLD_PCT  – percentage band above/below VWAP before signalling
 *                         (default 0.1)
 */

const THRESHOLD = Number(process.env.VWAP_THRESHOLD_PCT || 0.1);
const { DEFAULT_TARGET_RR, computeTarget } = require("./target");

module.exports = {
	name: "VWAP",
	label: "VWAP Crossover",
	description:
		`Signals BUY when price is >${THRESHOLD}% above daily VWAP, ` +
		`SELL when >${THRESHOLD}% below. Uses NSE's intraday VWAP from tick data. Target uses ${DEFAULT_TARGET_RR}:1 reward:risk from stoploss.`,

	extraFields: [
		{ key: "lastTradePrice", label: "LTP"          },
		{ key: "vwap",           label: "VWAP"         },
		{ key: "diffPct",        label: "Diff %"       },
		{ key: "stoploss",       label: "Stoploss"     },
			{ key: "target",         label: "Target"       },
	],

	initStockState: () => ({
		lastTradePrice: 0,
		vwap: 0,
		diffPct: 0,
		status: "Hold",
		stoploss: 0,
		target: 0,
	}),

	onTick(state, tick, _currentTime) {
		const price = tick.last_price;
		const vwap  = tick.average_price || 0;   // Kite provides daily VWAP here
		const s     = { ...state, lastTradePrice: price, vwap };

		if (vwap > 0) {
			const diffPct     = ((price - vwap) / vwap) * 100;
			s.diffPct         = Math.round(diffPct * 100) / 100;

			if (diffPct > THRESHOLD) {
				s.status   = "Buy";
				s.stoploss = Math.round(vwap * 100) / 100;
				s.target   = computeTarget(s.status, price, s.stoploss);
			} else if (diffPct < -THRESHOLD) {
				s.status   = "Sell";
				s.stoploss = Math.round(vwap * 100) / 100;
				s.target   = computeTarget(s.status, price, s.stoploss);
			} else {
				s.status   = "Hold";
				s.stoploss = 0;
				s.target   = 0;
			}
		}

		return s;
	},

	matchesCriteria: (state) => state.status === "Buy" || state.status === "Sell",
};
