// @ts-nocheck
/**
 * ORB – Opening Range Breakout
 *
 * Logic:
 *  - Track high and low of every tick during 09:15–09:30 (configurable).
 *  - After the ORB window closes, signal BUY if price breaks above ORB high,
 *    SELL if price breaks below ORB low; stoploss is the opposite boundary.
 *
 * Extra display fields: orbHigh, orbLow
 */

const ORB_START_TIME = process.env.ORB_START_TIME || "09:15:00";
const ORB_END_TIME   = process.env.ORB_END_TIME   || "09:30:00";

module.exports = {
	name: "ORB",
	label: "Opening Range Breakout",
	description:
		"Tracks the high/low during the first 15 min (09:15–09:30). " +
		"Signals BUY on upward breakout, SELL on downward breakout.",

	extraFields: [
		{ key: "orbHigh",       label: "ORB High" },
		{ key: "orbLow",        label: "ORB Low"  },
		{ key: "lastTradePrice", label: "LTP"      },
		{ key: "stoploss",      label: "Stoploss"  },
	],

	/** Returns a fresh per-stock state object. */
	initStockState: () => ({
		lastTradePrice: 0,
		orbHigh: null,
		orbLow: null,
		status: "Hold",
		stoploss: 0,
	}),

	/**
	 * Pure tick processor – returns updated state without mutating the input.
	 * @param {object} state     Current stock state
	 * @param {object} tick      Raw KiteTicker tick
	 * @param {string} currentTime  "HH:MM:SS" in IST
	 */
	onTick(state, tick, currentTime) {
		const price = tick.last_price;
		const s     = { ...state };

		// Build ORB range inside the window
		if (currentTime >= ORB_START_TIME && currentTime <= ORB_END_TIME) {
			s.orbHigh = s.orbHigh === null ? price : Math.max(s.orbHigh, price);
			s.orbLow  = s.orbLow  === null ? price : Math.min(s.orbLow,  price);
		}

		s.lastTradePrice = price;

		if (s.orbHigh !== null && price > s.orbHigh) {
			s.status   = "Buy";
			s.stoploss = s.orbLow ?? 0;
		} else if (s.orbLow !== null && price < s.orbLow) {
			s.status   = "Sell";
			s.stoploss = s.orbHigh ?? 0;
		} else {
			s.status   = "Hold";
			s.stoploss = 0;
		}

		return s;
	},

	/** Only surface stocks with an actionable signal. */
	matchesCriteria: (state) => state.status === "Buy" || state.status === "Sell",
};
