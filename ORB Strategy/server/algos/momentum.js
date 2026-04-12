// @ts-nocheck
/**
 * MOMENTUM – Percentage change from day open
 *
 * Logic:
 *  - KiteTicker (full mode) provides `ohlc.open` (today's open price).
 *  - Signal BUY  when last_price >= open * (1 + threshold%) – upward momentum.
 *  - Signal SELL when last_price <= open * (1 - threshold%) – downward momentum.
 *  - Stoploss is set to the day's open price.
 *
 * Extra display fields: openPrice, changePct
 *
 * Env vars:
 *   MOMENTUM_THRESHOLD_PCT  –  % move from open required to signal (default 0.5)
 */

const THRESHOLD = Number(process.env.MOMENTUM_THRESHOLD_PCT || 0.5);

module.exports = {
	name: "MOMENTUM",
	label: "Momentum (% from Open)",
	description:
		`Signals BUY when price is ≥${THRESHOLD}% above day open, ` +
		`SELL when ≥${THRESHOLD}% below. Stoploss at day open.`,

	extraFields: [
		{ key: "lastTradePrice", label: "LTP"        },
		{ key: "openPrice",      label: "Day Open"   },
		{ key: "changePct",      label: "Change %"   },
		{ key: "stoploss",       label: "Stoploss"   },
	],

	initStockState: () => ({
		lastTradePrice: 0,
		openPrice: 0,
		changePct: 0,
		status: "Hold",
		stoploss: 0,
	}),

	onTick(state, tick, _currentTime) {
		const price     = tick.last_price;
		const openPrice = tick.ohlc?.open || 0;
		const s         = { ...state, lastTradePrice: price, openPrice };

		if (openPrice > 0) {
			const changePct = ((price - openPrice) / openPrice) * 100;
			s.changePct     = Math.round(changePct * 100) / 100;

			if (changePct >= THRESHOLD) {
				s.status   = "Buy";
				s.stoploss = openPrice;
			} else if (changePct <= -THRESHOLD) {
				s.status   = "Sell";
				s.stoploss = openPrice;
			} else {
				s.status   = "Hold";
				s.stoploss = 0;
			}
		}

		return s;
	},

	matchesCriteria: (state) => state.status === "Buy" || state.status === "Sell",
};
