// @ts-nocheck
/**
 * Algo registry – add new algos here.
 * Each algo must export:
 *   name           {string}   Unique key used in API / socket messages
 *   label          {string}   Human-readable name shown in the UI
 *   description    {string}   Short description shown in the UI
 *   extraFields    {Array<{key, label}>}  Fields to display beyond status
 *   initStockState {()=>object}           Returns a fresh per-stock state
 *   onTick         {(state, tick, currentTimeIST)=>state}  Pure tick processor
 *   matchesCriteria{(state)=>boolean}     Whether to include in signals output
 */

const orb      = require("./orb");
const vwap     = require("./vwap");
const momentum = require("./momentum");
const ema      = require("./ema");
const consensus = require("./consensus");

/** @type {Record<string, import('./orb')>} */
const ALGOS = {
	[consensus.name]: consensus,
	[orb.name]:       orb,
	[vwap.name]:      vwap,
	[momentum.name]:  momentum,
	[ema.name]:       ema,
};

const DEFAULT_ALGO = orb.name;

/**
 * Returns the algo object for a given name, or the default if not found.
 * @param {string} name
 */
function getAlgo(name) {
	return ALGOS[name] || ALGOS[DEFAULT_ALGO];
}

/**
 * Returns meta info for all algos (for the API / frontend dropdown).
 */
function getAlgoList() {
	return Object.values(ALGOS).map(({ name, label, description, extraFields }) => ({
		name,
		label,
		description,
		extraFields,
	}));
}

module.exports = { ALGOS, DEFAULT_ALGO, getAlgo, getAlgoList };
