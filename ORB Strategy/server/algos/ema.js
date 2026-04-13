// @ts-nocheck
/**
 * EMA Crossover – Short EMA / Long EMA crossover on tick prices
 *
 * Logic:
 *  - Maintain two Exponential Moving Averages (default 9-period and 21-period)
 *    computed over successive tick prices using standard EMA formula:
 *      EMA = price × k + prevEMA × (1 - k),   k = 2 / (period + 1)
 *  - Signal BUY  on the tick when shortEMA crosses above longEMA.
 *  - Signal SELL on the tick when shortEMA crosses below  longEMA.
 *  - Signal persists until the next crossover.
 *  - Stoploss is set to the current longEMA value (dynamic trailing).
 *
 * Extra display fields: shortEMA, longEMA
 *
 * Env vars:
 *   EMA_SHORT_PERIOD  – default 9
 *   EMA_LONG_PERIOD   – default 21
 */

const SHORT_PERIOD = Number(process.env.EMA_SHORT_PERIOD || 9);
const LONG_PERIOD  = Number(process.env.EMA_LONG_PERIOD  || 21);
const { DEFAULT_TARGET_RR, computeTarget } = require("./target");

function calcEMA(price, prevEMA, period) {
	const k = 2 / (period + 1);
	return prevEMA === null ? price : price * k + prevEMA * (1 - k);
}

module.exports = {
	name: "EMA",
	label: `EMA Crossover (${SHORT_PERIOD}/${LONG_PERIOD})`,
	description:
		`Signals BUY when the ${SHORT_PERIOD}-EMA crosses above the ${LONG_PERIOD}-EMA ` +
		`and SELL on the reverse crossover. Stoploss tracks the ${LONG_PERIOD}-EMA. Target uses ${DEFAULT_TARGET_RR}:1 reward:risk from stoploss.`,

	extraFields: [
		{ key: "lastTradePrice", label: "LTP"                               },
		{ key: "shortEMA",       label: `EMA ${SHORT_PERIOD}`               },
		{ key: "longEMA",        label: `EMA ${LONG_PERIOD}`                },
		{ key: "stoploss",       label: `Stoploss (EMA ${LONG_PERIOD})`     },
			{ key: "target",         label: "Target"                          },
	],

	initStockState: () => ({
		lastTradePrice: 0,
		shortEMA: null,
		longEMA: null,
		prevShortEMA: null,
		prevLongEMA: null,
		tickCount: 0,
		status: "Hold",
		stoploss: 0,
		target: 0,
	}),

	onTick(state, tick, _currentTime) {
		const price = tick.last_price;
		const s     = { ...state };

		s.lastTradePrice = price;
		s.tickCount     += 1;

		// Save previous before updating
		s.prevShortEMA   = s.shortEMA;
		s.prevLongEMA    = s.longEMA;

		s.shortEMA = calcEMA(price, s.shortEMA, SHORT_PERIOD);
		s.longEMA  = calcEMA(price, s.longEMA,  LONG_PERIOD);

		// Round for display
		if (s.shortEMA !== null) s.shortEMA = Math.round(s.shortEMA * 100) / 100;
		if (s.longEMA  !== null) s.longEMA  = Math.round(s.longEMA  * 100) / 100;

		// Wait for at least LONG_PERIOD ticks before trusting EMA values
		if (s.tickCount >= LONG_PERIOD && s.prevShortEMA !== null && s.prevLongEMA !== null) {
			const crossedAbove = s.prevShortEMA <= s.prevLongEMA && s.shortEMA > s.longEMA;
			const crossedBelow = s.prevShortEMA >= s.prevLongEMA && s.shortEMA < s.longEMA;

			if (crossedAbove) {
				s.status   = "Buy";
			} else if (crossedBelow) {
				s.status   = "Sell";
			}
			// status persists between crossovers intentionally
		}

		// Stoploss tracks long EMA dynamically
		s.stoploss = (s.status !== "Hold" && s.longEMA !== null)
			? s.longEMA
			: 0;
		s.target = s.status !== "Hold"
			? computeTarget(s.status, price, s.stoploss)
			: 0;

		return s;
	},

	matchesCriteria: (state) => state.status === "Buy" || state.status === "Sell",
};
