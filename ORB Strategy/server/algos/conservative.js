// @ts-nocheck
/**
 * CONSERVATIVE – Capital-protection-first intraday filter
 *
 * Uses ORB + VWAP + Momentum + EMA states and only emits signals when:
 *  - EMA trend agrees with directional bias
 *  - At least 3 of 4 strategies vote in one direction
 *  - Expected reward:risk is above minimum threshold
 *
 * This intentionally trades less frequently than CONSENSUS.
 */

const orb = require("./orb");
const vwap = require("./vwap");
const momentum = require("./momentum");
const ema = require("./ema");
const { DEFAULT_TARGET_RR, computeTarget } = require("./target");

const ALGOS = [orb, vwap, momentum, ema];
const MIN_AGREE = Number(process.env.CONSERVATIVE_MIN_AGREE || 3);
const MIN_RR = Number(process.env.CONSERVATIVE_MIN_RR || 1.8);
const ORB_END_TIME = process.env.ORB_END_TIME || "09:30:00";

module.exports = {
	name: "CONSERVATIVE",
	label: "Conservative Intraday",
	description:
		`High-conviction intraday mode. Requires ${MIN_AGREE}/4 strategy agreement, EMA trend confirmation, and minimum RR ${MIN_RR}.`,

	extraFields: [
		{ key: "lastTradePrice", label: "LTP" },
		{ key: "signal", label: "Signal" },
		{ key: "confidence", label: "Confidence %" },
		{ key: "rr", label: "Est RR" },
		{ key: "stoploss", label: "Stoploss" },
		{ key: "target", label: "Target" },
		{ key: "gate", label: "Gate" },
	],

	initStockState: () => ({
		lastTradePrice: 0,
		signal: "Hold",
		confidence: 0,
		rr: 0,
		stoploss: 0,
		target: 0,
		gate: "Waiting",
		algoStates: {
			ORB: orb.initStockState(),
			VWAP: vwap.initStockState(),
			Momentum: momentum.initStockState(),
			EMA: ema.initStockState(),
		},
	}),

	onTick(state, tick, currentTime) {
		const s = { ...state };
		const price = Number(tick.last_price || 0);
		s.lastTradePrice = price;

		for (const algo of ALGOS) {
			s.algoStates[algo.name] = algo.onTick(s.algoStates[algo.name], tick, currentTime);
		}

		const orbState = s.algoStates.ORB;
		const emaState = s.algoStates.EMA;
		const votes = {
			ORB: orbState?.status,
			VWAP: s.algoStates.VWAP?.status,
			Momentum: s.algoStates.Momentum?.status,
			EMA: emaState?.status,
		};

		const orbUnavailable = currentTime > ORB_END_TIME && (orbState?.orbHigh === null || orbState?.orbLow === null);
		const usableVotes = Object.entries(votes).filter(([key]) => !(key === "ORB" && orbUnavailable));

		const buyVoters = usableVotes.filter(([, value]) => value === "Buy").map(([key]) => key);
		const sellVoters = usableVotes.filter(([, value]) => value === "Sell").map(([key]) => key);
		const activeCount = usableVotes.length;

		const emaTrendOkBuy = votes.EMA === "Buy";
		const emaTrendOkSell = votes.EMA === "Sell";
		const winner = buyVoters.length >= sellVoters.length ? "Buy" : "Sell";
		const winnerCount = winner === "Buy" ? buyVoters.length : sellVoters.length;

		const confidence = activeCount > 0 ? Math.round((winnerCount / activeCount) * 100) : 0;
		const candidateStoploss = deriveStoploss(winner, price, s.algoStates);
		const target = computeTarget(winner, price, candidateStoploss, DEFAULT_TARGET_RR);
		const risk = Math.abs(price - candidateStoploss);
		const reward = Math.abs(target - price);
		const rr = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;

		const agreementPass = winnerCount >= Math.min(MIN_AGREE, activeCount);
		const trendPass = winner === "Buy" ? emaTrendOkBuy : emaTrendOkSell;
		const rrPass = rr >= MIN_RR;

		if (agreementPass && trendPass && rrPass && target > 0 && candidateStoploss > 0) {
			s.signal = winner;
			s.confidence = confidence;
			s.stoploss = candidateStoploss;
			s.target = target;
			s.rr = rr;
			s.gate = `PASS (${winnerCount}/${activeCount})`;
		} else {
			s.signal = "Hold";
			s.confidence = 0;
			s.stoploss = 0;
			s.target = 0;
			s.rr = 0;

			const reasons = [];
			if (!agreementPass) reasons.push(`agree<${Math.min(MIN_AGREE, activeCount || MIN_AGREE)}`);
			if (!trendPass) reasons.push("EMA trend");
			if (!rrPass) reasons.push(`RR<${MIN_RR}`);
			s.gate = reasons.length > 0 ? `BLOCKED: ${reasons.join(", ")}` : "Waiting";
		}

		return s;
	},

	matchesCriteria: (state) => state.signal === "Buy" || state.signal === "Sell",
};

function median(values) {
	if (!Array.isArray(values) || values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 !== 0) return sorted[mid];
	return (sorted[mid - 1] + sorted[mid]) / 2;
}

function deriveStoploss(signal, entryPrice, algoStates) {
	const candidates = [];
	const keys = ["ORB", "VWAP", "Momentum", "EMA"];

	for (const key of keys) {
		const sl = Number(algoStates?.[key]?.stoploss || 0);
		if (!Number.isFinite(sl) || sl <= 0) continue;

		if (signal === "Buy" && sl < entryPrice) candidates.push(sl);
		if (signal === "Sell" && sl > entryPrice) candidates.push(sl);
	}

	return median(candidates);
}
