// @ts-nocheck

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography,
} from "@mui/material";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8001";

const WATCHLIST_OPTIONS = [
	{ value: "NIFTY50",  label: "Nifty 50  (50 stocks)"  },
	{ value: "NIFTY100", label: "Nifty 100 (100 stocks)" },
	{ value: "NIFTY500", label: "Nifty 500 (500 stocks)" },
];

function Start({ onStreamStarted }) {
	const [token, setToken]         = useState("");
	const [step, setStep]           = useState("login"); // login | getToken | configure | running
	const [algos, setAlgos]         = useState([]);
	const [selectedAlgo, setAlgo]   = useState("ORB");
	const [watchlist, setWatchlist] = useState("NIFTY50");
	const [error, setError]         = useState("");
	const [loading, setLoading]     = useState(false);
	const [notice, setNotice]       = useState("");

	// Fetch available algos from the server
	useEffect(() => {
		axios
			.get(`${API_BASE_URL}/api/algos`)
			.then((res) => setAlgos(res.data))
			.catch(() => {
				// Fallback list so UI never breaks
				setAlgos([
					{ name: "CONSERVATIVE", label: "Conservative Intraday"      },
					{ name: "CONSENSUS", label: "Consensus (3+ Algos)"       },
					{ name: "ORB",      label: "Opening Range Breakout"   },
					{ name: "VWAP",     label: "VWAP Crossover"           },
					{ name: "MOMENTUM", label: "Momentum (% from Open)"   },
					{ name: "EMA",      label: "EMA Crossover (9/21)"     },
				]);
			});

		// If we already have an access token, skip straight to configure
		if (localStorage.getItem("accessToken")) {
			setStep("configure");
		}
	}, []);

	const handleKiteLogin = async () => {
		setError("");
		setNotice("");
		setLoading(true);

		try {
			const res = await axios.get(`${API_BASE_URL}/api/login/url`, {
				headers: {
					"Cache-Control": "no-cache",
					Pragma: "no-cache",
				},
			});
			const payload = res?.data;
			const loginUrl = (payload && typeof payload === "object") ? payload.loginUrl : null;
			if (!loginUrl) {
				throw new Error("Invalid /api/login/url response. API may be routed to frontend instead of backend.");
			}
			setNotice("Redirecting to Kite login...");
			window.location.assign(loginUrl);
		} catch (err) {
			const message = err?.response?.data?.error || err.message || "Unable to open Kite login";
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	const handleSendToken = async () => {
		setError("");
		setNotice("");
		setLoading(true);
		try {
			const res = await axios.post(`${API_BASE_URL}/api/login`, { requestToken: token });
			localStorage.setItem("accessToken", res.data.accessToken);
			setNotice("Access token saved. Configure strategy and start the stream.");
			setStep("configure");
		} catch (err) {
			setError(err?.response?.data?.error || "Unable to get access token");
		} finally {
			setLoading(false);
		}
	};

	const handleStart = async () => {
		setError("");
		setNotice("");
		setLoading(true);
		const accessToken = localStorage.getItem("accessToken");
		if (!accessToken) {
			setError("No access token found. Please log in again.");
			setStep("login");
			setLoading(false);
			return;
		}
		try {
			const res = await axios.post(`${API_BASE_URL}/api/stream/start`, {
				accessToken,
				algo: selectedAlgo,
			});
			setStep("running");
			setNotice(`Stream running with ${res.data.algoLabel} (${res.data.instruments} instruments).`);
			if (onStreamStarted) {
				onStreamStarted({
					algo:        res.data.algo,
					algoLabel:   res.data.algoLabel,
					instruments: res.data.instruments,
				});
			}
		} catch (err) {
			if (err?.response?.status === 401) {
				localStorage.removeItem("accessToken");
				setStep("login");
				setError("Access token expired. Please log in again.");
			} else {
				setError(err?.response?.data?.error || err.message);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleSwitchAlgo = async (newAlgo) => {
		setAlgo(newAlgo);
		setError("");
		setNotice("");
		try {
			await axios.post(`${API_BASE_URL}/api/algo`, { algo: newAlgo });
			setNotice(`Switched to ${newAlgo} algorithm.`);
		} catch (err) {
			setError(err?.response?.data?.error || "Failed to switch algo");
		}
	};

	return (
		<Card variant='outlined' sx={{ borderRadius: 3 }}>
			<CardContent>
				<Stack spacing={2.5}>
					<Box>
						<Typography variant='h6' fontWeight={700}>
							Strategy Control
						</Typography>
						<Typography variant='body2' color='text.secondary'>
							Authenticate, choose algorithm, and run live signal scanning.
						</Typography>
					</Box>

					{error ? <Alert severity='error'>{error}</Alert> : null}
					{notice ? <Alert severity='info'>{notice}</Alert> : null}

			{/* ── Step 1: Login via Kite ─────────────────── */}
			{step === "login" && (
				<Stack spacing={1.5}>
					<Typography variant='body2' color='text.secondary'>
						Connect your Kite account. After login, you will be returned automatically and the access token will be stored for you.
					</Typography>
					<Button variant='contained' onClick={handleKiteLogin} disabled={loading}>
						{loading ? "Opening Kite Login" : "Login with Kite"}
					</Button>
				</Stack>
			)}

			{/* ── Step 2: Paste request token ───────────── */}
			{step === "getToken" && (
				<Stack spacing={1.5}>
					<Typography variant='body2' color='text.secondary'>
						Paste request token from the redirect URL.
					</Typography>
					<TextField
						fullWidth
						placeholder='request_token=...'
						value={token}
						onChange={(e) => setToken(e.target.value)}
					/>
					<Button
						variant='contained'
						onClick={handleSendToken}
						disabled={loading || !token.trim()}
						startIcon={loading ? <CircularProgress size={16} /> : null}
					>
						{loading ? "Verifying" : "Get Access Token"}
					</Button>
				</Stack>
			)}

			{/* ── Step 3: Choose algo & watchlist, then start ─ */}
			{step === "configure" && (
				<Stack spacing={2}>
					<FormControl fullWidth>
						<InputLabel id='algo-label'>Algorithm</InputLabel>
						<Select
							labelId='algo-label'
							label='Algorithm'
							value={selectedAlgo}
							onChange={(e) => setAlgo(e.target.value)}
						>
							{algos.map((a) => (
								<MenuItem key={a.name} value={a.name}>
									{a.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					{algos.find((a) => a.name === selectedAlgo)?.description ? (
						<Typography variant='caption' color='text.secondary'>
							{algos.find((a) => a.name === selectedAlgo).description}
						</Typography>
					) : null}

					<FormControl fullWidth>
						<InputLabel id='watch-label'>Watchlist</InputLabel>
						<Select
							labelId='watch-label'
							label='Watchlist'
							value={watchlist}
							onChange={(e) => setWatchlist(e.target.value)}
						>
							{WATCHLIST_OPTIONS.map((w) => (
								<MenuItem key={w.value} value={w.value}>
									{w.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<Typography variant='caption' color='text.secondary'>
						Signals only show stocks matching selected algorithm criteria.
					</Typography>

					<Button
						variant='contained'
						size='large'
						onClick={handleStart}
						disabled={loading}
						startIcon={loading ? <CircularProgress size={16} /> : null}
					>
						{loading ? "Starting" : "Start Stream"}
					</Button>
				</Stack>
			)}

			{/* ── Step 4: Running – allow live algo switch ── */}
			{step === "running" && (
				<Stack spacing={1.5}>
					<FormControl fullWidth>
						<InputLabel id='switch-algo-label'>Switch Algorithm</InputLabel>
						<Select
							labelId='switch-algo-label'
							label='Switch Algorithm'
							value={selectedAlgo}
							onChange={(e) => handleSwitchAlgo(e.target.value)}
						>
							{algos.map((a) => (
								<MenuItem key={a.name} value={a.name}>
									{a.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<Typography variant='caption' color='text.secondary'>
						Switching resets algorithm state but keeps the realtime stream active.
					</Typography>
				</Stack>
			)}
				</Stack>
			</CardContent>
		</Card>
	);
}

export default Start;
