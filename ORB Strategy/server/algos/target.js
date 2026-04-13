// @ts-nocheck

const DEFAULT_TARGET_RR = Number(process.env.ALGO_TARGET_RR || 2);

function computeTarget(signal, entryPrice, stoploss, rr = DEFAULT_TARGET_RR) {
	if (!entryPrice || !stoploss || !rr) return 0;

	const risk = Math.abs(entryPrice - stoploss);
	if (!Number.isFinite(risk) || risk <= 0) return 0;

	if (signal === "Buy") {
		if (stoploss >= entryPrice) return 0;
		return Math.round((entryPrice + risk * rr) * 100) / 100;
	}

	if (signal === "Sell") {
		if (stoploss <= entryPrice) return 0;
		return Math.round((entryPrice - risk * rr) * 100) / 100;
	}

	return 0;
}

module.exports = {
	DEFAULT_TARGET_RR,
	computeTarget,
};