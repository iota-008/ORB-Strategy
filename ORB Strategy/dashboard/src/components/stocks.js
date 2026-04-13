// @ts-nocheck

import React from "react";
import {
	Card,
	CardContent,
	Chip,
	Divider,
	Grid,
	Stack,
	Typography,
} from "@mui/material";

// Fields that exist for internal algo bookkeeping and should not be displayed
const HIDDEN_FIELDS = new Set([
	"name", "status", "prevShortEMA", "prevLongEMA", "tickCount", "algoStates",
]);

// Human-readable labels for known field keys
const FIELD_LABELS = {
	lastTradePrice: "LTP",
	stoploss:       "Stoploss",
	orbHigh:        "ORB High",
	orbLow:         "ORB Low",
	vwap:           "VWAP",
	diffPct:        "VWAP Diff %",
	openPrice:      "Day Open",
	changePct:      "Change %",
	shortEMA:       "Short EMA",
	longEMA:        "Long EMA",
	consensus:      "Consensus",
	confidence:     "Confidence",
	algoVotes:      "Algorithm Votes",
	target:         "Target",
};

function formatValue(key, value) {
	if (value === null || value === undefined) return "—";
	if (typeof value === "number") {
		if (key.endsWith("Pct") || key.endsWith("pct") || key === "confidence") return `${value.toFixed(2)}%`;
		return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
	}
	return String(value);
}

function Stocks({ stock }) {
	if (!stock) return null;

	const resolvedStatus =
		stock.status === "Buy" || stock.status === "Sell"
			? stock.status
			: stock.signal === "Buy" || stock.signal === "Sell"
			? stock.signal
			: stock.consensus === "Buy" || stock.consensus === "Sell"
			? stock.consensus
			: stock.status;

	const isBuy  = resolvedStatus === "Buy";
	const isSell = resolvedStatus === "Sell";

	const statusColor = isBuy ? "success" : isSell ? "error" : "default";

	// Collect display fields: everything that isn't hidden and has a value
	const displayFields = Object.keys(stock).filter(
		(k) =>
			!HIDDEN_FIELDS.has(k) &&
			stock[k] !== null &&
			stock[k] !== undefined &&
			typeof stock[k] !== "object"
	);

	return (
		<Card
			variant='outlined'
			sx={{
				height: "100%",
				borderRadius: 3,
				borderColor: isBuy ? "success.main" : isSell ? "error.main" : "divider",
				background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
			}}
		>
			<CardContent>
				<Stack direction='row' justifyContent='space-between' alignItems='center' spacing={1.5}>
					<Typography variant='h6' fontWeight={700} noWrap>
						{stock.name}
					</Typography>
					<Chip label={resolvedStatus} color={statusColor} size='small' />
				</Stack>

				<Divider sx={{ my: 1.5 }} />

				<Grid container spacing={1.5}>
					{displayFields.map((key) => (
						<Grid item xs={key === "algoVotes" ? 12 : 6} key={key}>
							<Typography variant='caption' color='text.secondary'>
								{FIELD_LABELS[key] || key}
							</Typography>
							<Typography
								variant='body2'
								fontWeight={600}
								sx={
									key === "changePct" || key === "diffPct"
										? { color: stock[key] >= 0 ? "success.light" : "error.light" }
										: undefined
								}
							>
								{formatValue(key, stock[key])}
							</Typography>
						</Grid>
					))}
				</Grid>
			</CardContent>
		</Card>
	);
}

export default Stocks;
