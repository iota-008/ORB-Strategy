// @ts-nocheck
import React, { useEffect, useState } from "react";
import Header from "./header";
import Start from "./start";
import Stocks from "./stocks";
import {
	Alert,
	Box,
	Chip,
	Container,
	FormControl,
	Grid,
	InputLabel,
	InputAdornment,
	MenuItem,
	Paper,
	Select,
	Stack,
	TextField,
	Typography,
} from "@mui/material";

import socketIOClient from "socket.io-client";

const ENDPOINT = process.env.REACT_APP_SOCKET_URL || "http://127.0.0.1:4001";
const ESTIMATOR_RR = Number(process.env.REACT_APP_ESTIMATOR_RR || 2);

function getActionSignal(stock) {
	if (stock?.status === "Buy" || stock?.status === "Sell") return stock.status;
	if (stock?.signal === "Buy" || stock?.signal === "Sell") return stock.signal;
	if (stock?.consensus === "Buy" || stock?.consensus === "Sell") return stock.consensus;
	return null;
}

function getEstimatedTarget(stock, status) {
	const explicitTarget = Number(stock?.target);
	if (Number.isFinite(explicitTarget) && explicitTarget > 0) return explicitTarget;

	const entry = Number(stock?.lastTradePrice);
	const stoploss = Number(stock?.stoploss);
	if (!Number.isFinite(entry) || entry <= 0) return null;
	if (!Number.isFinite(stoploss) || stoploss <= 0) return null;

	const risk = Math.abs(entry - stoploss);
	if (!Number.isFinite(risk) || risk <= 0) return null;

	if (status === "Buy") {
		if (stoploss >= entry) return null;
		return entry + risk * ESTIMATOR_RR;
	}

	if (status === "Sell") {
		if (stoploss <= entry) return null;
		return entry - risk * ESTIMATOR_RR;
	}

	return null;
}

function getSignalMetrics(stock, investmentAmount) {
	const status = getActionSignal(stock);
	const entry = Number(stock?.lastTradePrice);
	const target = getEstimatedTarget(stock, status);
	const changePct = Number(stock?.changePct);
	const diffPct = Number(stock?.diffPct);

	let estimatedReturnPct = null;
	if ((status === "Buy" || status === "Sell") && Number.isFinite(entry) && entry > 0 && Number.isFinite(target)) {
		estimatedReturnPct = status === "Buy" ? ((target - entry) / entry) * 100 : ((entry - target) / entry) * 100;
	}

	const estimatedProfit = Number.isFinite(estimatedReturnPct)
		? investmentAmount * (estimatedReturnPct / 100)
		: null;

	return {
		status,
		entry,
		target,
		changePct: Number.isFinite(changePct) ? changePct : null,
		diffPct: Number.isFinite(diffPct) ? diffPct : null,
		estimatedReturnPct,
		estimatedProfit,
	};
}

function compareDescending(a, b) {
	const left = Number.isFinite(a) ? a : -Infinity;
	const right = Number.isFinite(b) ? b : -Infinity;
	return right - left;
}

function Home({ setLoadClient }) {
	// payload: { algo, algoLabel, signals, total, matched, updatedAt }
	const [payload, setPayload]       = useState(null);
	const [streamInfo, setStreamInfo] = useState(null); // { algo, algoLabel, instruments }
	const [socketConnected, setSocketConnected] = useState(false);
	const [nowMs, setNowMs] = useState(Date.now());
	const [investmentAmount, setInvestmentAmount] = useState("10000");
	const [selectedStockName, setSelectedStockName] = useState("__ALL__");
	const [sortBy, setSortBy] = useState("estimatedProfitDesc");

	useEffect(() => {
		const socket = socketIOClient(ENDPOINT);

		socket.on("connect", () => {
			setSocketConnected(true);
		});

		socket.on("connect_error", (err) => {
			setSocketConnected(false);
			console.error("Socket connect error:", err.message);
		});

		socket.on("disconnect", () => {
			setSocketConnected(false);
		});

		socket.on("FromAPI", (data) => {
			setPayload(data);
		});

		return () => {
			socket.disconnect();
			setLoadClient(false);
		};
	}, [setLoadClient]);

	useEffect(() => {
		const timer = setInterval(() => setNowMs(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	const signals  = payload?.signals  || [];
	const total    = payload?.total    ?? 0;
	const matched  = payload?.matched  ?? 0;
	const algoLabel = payload?.algoLabel || streamInfo?.algoLabel || "";
	const updatedAt = payload?.updatedAt || "";
	const updatedAtMs = Number(payload?.updatedAtMs || 0);
	const staleSeconds = updatedAtMs > 0 ? Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000)) : null;
	const isStale = staleSeconds !== null && staleSeconds > 15;
	const parsedInvestment = Math.max(0, Number(investmentAmount) || 0);

	const actionableSignals = signals.filter((stock) => {
		const status = getActionSignal(stock);
		const entry = Number(stock?.lastTradePrice);
		const target = getEstimatedTarget(stock, status);

		return (status === "Buy" || status === "Sell") && Number.isFinite(entry) && entry > 0 && Number.isFinite(target) && target > 0;
	});

	useEffect(() => {
		if (selectedStockName === "__ALL__") return;
		const exists = actionableSignals.some((stock) => stock?.name === selectedStockName);
		if (!exists) setSelectedStockName("__ALL__");
	}, [actionableSignals, selectedStockName]);

	const selectedSignals =
		selectedStockName === "__ALL__"
			? actionableSignals
			: actionableSignals.filter((stock) => stock?.name === selectedStockName);

	const sortedSignals = [...signals].sort((leftStock, rightStock) => {
		const left = getSignalMetrics(leftStock, parsedInvestment);
		const right = getSignalMetrics(rightStock, parsedInvestment);

		switch (sortBy) {
			case "estimatedProfitDesc":
				return compareDescending(left.estimatedProfit, right.estimatedProfit) || leftStock.name.localeCompare(rightStock.name);
			case "estimatedReturnDesc":
				return compareDescending(left.estimatedReturnPct, right.estimatedReturnPct) || leftStock.name.localeCompare(rightStock.name);
			case "changeDesc":
				return compareDescending(left.changePct, right.changePct) || leftStock.name.localeCompare(rightStock.name);
			case "changeAsc":
				return compareDescending(right.changePct, left.changePct) || leftStock.name.localeCompare(rightStock.name);
			case "diffDesc":
				return compareDescending(left.diffPct, right.diffPct) || leftStock.name.localeCompare(rightStock.name);
			case "nameAsc":
			default:
				return leftStock.name.localeCompare(rightStock.name);
		}
	});

	const perSignalCapital = selectedSignals.length > 0 ? parsedInvestment / selectedSignals.length : 0;
	const projectedProfit = selectedSignals.reduce((sum, stock) => {
		const status = getActionSignal(stock);
		const entry = Number(stock?.lastTradePrice);
		const target = getEstimatedTarget(stock, status);
		const returnPct = status === "Buy" ? (target - entry) / entry : (entry - target) / entry;

		if (!Number.isFinite(returnPct)) return sum;
		return sum + perSignalCapital * returnPct;
	}, 0);

	const projectedEndValue = parsedInvestment + projectedProfit;

	let streamStatusLabel = "Connecting";
	let streamStatusColor = "default";

	if (!socketConnected) {
		streamStatusLabel = "Disconnected";
		streamStatusColor = "error";
	} else if (isStale) {
		streamStatusLabel = `Stale (${staleSeconds}s)`;
		streamStatusColor = "warning";
	} else if (updatedAtMs > 0) {
		streamStatusLabel = "Live";
		streamStatusColor = "success";
	}

	return (
		<Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: 4 }}>
			<Header />
			<Container maxWidth='xl' sx={{ pt: 3 }}>
				<Grid container spacing={3}>
					<Grid item xs={12} md={4} lg={3}>
						<Start onStreamStarted={setStreamInfo} />
					</Grid>
					<Grid item xs={12} md={8} lg={9}>
						<Stack spacing={2.5}>
							<Paper
								variant='outlined'
								sx={{ p: 2.5, borderRadius: 3, backgroundColor: "background.paper" }}
							>
								<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent='space-between'>
									<Box>
										<Typography variant='h6' fontWeight={700}>
											{algoLabel || "Select an algorithm"}
										</Typography>
										<Typography variant='body2' color='text.secondary'>
											Realtime market signals dashboard
										</Typography>
									</Box>
									<Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignSelf: "center" }} alignItems='center'>
										<FormControl size='small' sx={{ minWidth: 220 }}>
											<InputLabel id='sort-by-label'>Sort By</InputLabel>
											<Select
												labelId='sort-by-label'
												label='Sort By'
												value={sortBy}
												onChange={(e) => setSortBy(e.target.value)}
											>
												<MenuItem value='estimatedProfitDesc'>Max Estimated Profit (₹)</MenuItem>
												<MenuItem value='estimatedReturnDesc'>Max Estimated Return (%)</MenuItem>
												<MenuItem value='changeDesc'>Max Change %</MenuItem>
												<MenuItem value='changeAsc'>Min Change %</MenuItem>
												<MenuItem value='diffDesc'>Max VWAP Diff %</MenuItem>
												<MenuItem value='nameAsc'>Alphabetical</MenuItem>
											</Select>
										</FormControl>
										<Chip size='small' label={streamStatusLabel} color={streamStatusColor} variant='outlined' />
										<Typography variant='body2' color='text.secondary'>
											{matched} signal{matched !== 1 ? "s" : ""} from {total} stocks
											{updatedAt ? ` · ${updatedAt}` : ""}
										</Typography>
									</Stack>
								</Stack>
							</Paper>

							<Paper variant='outlined' sx={{ p: 2.5, borderRadius: 3 }}>
								<Stack spacing={1.25}>
									<Typography variant='subtitle1' fontWeight={700}>
										Estimated Profit (Today)
									</Typography>
									<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
										<TextField
											size='small'
											label='Investment Amount'
											type='number'
											value={investmentAmount}
											onChange={(e) => setInvestmentAmount(e.target.value)}
											sx={{ maxWidth: 240 }}
											InputProps={{
												startAdornment: <InputAdornment position='start'>₹</InputAdornment>,
											}}
										/>
										<FormControl size='small' sx={{ minWidth: 220 }}>
											<InputLabel id='stock-select-label'>Suggested Stock</InputLabel>
											<Select
												labelId='stock-select-label'
												label='Suggested Stock'
												value={selectedStockName}
												onChange={(e) => setSelectedStockName(e.target.value)}
											>
												<MenuItem value='__ALL__'>All Actionable Signals</MenuItem>
												{actionableSignals.map((stock) => {
													const status = getActionSignal(stock);
													return (
														<MenuItem key={stock.name} value={stock.name}>
															{stock.name} ({status})
														</MenuItem>
													);
												})}
											</Select>
										</FormControl>
										<Typography variant='body2' color='text.secondary'>
											Based on selected signal set ({selectedSignals.length}) and target levels.
										</Typography>
									</Stack>
									<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
										<Typography variant='body2' color='text.secondary'>
											Projected P/L: <Box component='span' sx={{ color: projectedProfit >= 0 ? "success.main" : "error.main", fontWeight: 700 }}>₹{projectedProfit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Box>
										</Typography>
										<Typography variant='body2' color='text.secondary'>
											Estimated End Value: <Box component='span' sx={{ fontWeight: 700 }}>₹{projectedEndValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Box>
										</Typography>
									</Stack>
									<Typography variant='caption' color='text.secondary'>
										Estimate uses algo target when available, otherwise derives target from stoploss with {ESTIMATOR_RR}:1 RR. Equal split applies only when multiple signals are selected.
									</Typography>
									<Typography variant='caption' color='text.secondary'>
										Sort by estimated profit/return uses your full entered investment amount per stock for ranking.
									</Typography>
								</Stack>
							</Paper>

							{signals.length > 0 ? (
								<Grid container spacing={2}>
									{sortedSignals.map((stock) => (
										<Grid item xs={12} sm={6} lg={4} key={stock.name}>
											<Stocks stock={stock} />
										</Grid>
									))}
								</Grid>
							) : (
								<Alert severity='info' variant='outlined'>
									{total > 0
										? `Watching ${total} stocks — no signals yet for ${algoLabel || "selected algorithm"}.`
										: "Waiting for market data stream to start..."}
								</Alert>
							)}
						</Stack>
					</Grid>
				</Grid>
			</Container>
		</Box>
	);
}

export default Home;
