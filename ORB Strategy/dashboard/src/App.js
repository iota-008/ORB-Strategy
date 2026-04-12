// @ts-nocheck
import "./App.css";

import React, { useCallback, useEffect, useState } from "react";
import Home from "./components/home";
import MarketClosedPage from "./components/MarketClosedPage";
import { Box, Button, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8001";

const theme = createTheme({
	palette: {
		mode: "dark",
		primary: {
			main: "#7c4dff",
		},
		secondary: {
			main: "#03dac6",
		},
		background: {
			default: "#0b0f17",
			paper: "#121826",
		},
	},
	shape: {
		borderRadius: 14,
	},
	typography: {
		fontFamily: '"Inter", "Roboto", "Segoe UI", sans-serif',
	},
	components: {
		MuiCard: {
			styleOverrides: {
				root: {
					backgroundImage: "none",
				},
			},
		},
	},
});

function App() {
	const [loadClient, setLoadClient] = useState(true);
	const [marketClosed, setMarketStatus] = useState(false);
	const startTime = "09:15:00";
	const closeTime = "15:30:00";

	const checkMarketStatus = useCallback(async () => {
		const now = new Date();
		const currentTime = now.toLocaleTimeString("en-GB", {
			hour12: false,
			timeZone: "Asia/Kolkata",
		});
		const weekday = now.toLocaleDateString("en-US", {
			weekday: "short",
			timeZone: "Asia/Kolkata",
		});
		const isWeekend = weekday === "Sat" || weekday === "Sun";
		const isClosed =
			isWeekend ||
			currentTime < startTime ||
			currentTime > closeTime;

		const accessToken = localStorage.getItem("accessToken") || "";

		try {
			const response = await axios.get(`${API_BASE_URL}/api/market/status`, {
				params: accessToken ? { accessToken } : {},
			});

			const isOpenFromApi = Boolean(response.data?.open);
			if (!isOpenFromApi) {
				setMarketStatus(true);
				setLoadClient(false);
				return;
			}
		} catch (_err) {
			if (isClosed) {
				setMarketStatus(true);
				setLoadClient(false);
				return;
			}
		}

		setMarketStatus((previousStatus) => {
			if (previousStatus) {
				setLoadClient(true);
			}
			return false;
		});
	}, [closeTime, startTime]);

	const toggleConnection = () => {
		if (!marketClosed) {
			setLoadClient((prevState) => !prevState);
		}
	};

	useEffect(() => {
		checkMarketStatus();
		const intervalId = setInterval(checkMarketStatus, 30000);

		return () => {
			clearInterval(intervalId);
		};
	}, [checkMarketStatus]);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
				{loadClient && !marketClosed ? (
					<Home setLoadClient={setLoadClient} />
				) : (
					<MarketClosedPage marketStatus={marketClosed} />
				)}
				{!marketClosed ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
						<Button variant='outlined' color='primary' onClick={toggleConnection}>
							{loadClient ? "Disconnect" : "Connect"}
						</Button>
					</Box>
				) : null}
			</Box>
		</ThemeProvider>
	);
}

export default App;
