// @ts-nocheck
import React, { useEffect, useState } from "react";
import Header from "./header";
import Start from "./start";
import Stocks from "./stocks";
import { Alert, Box, Container, Grid, Paper, Stack, Typography } from "@mui/material";

import socketIOClient from "socket.io-client";

const ENDPOINT = process.env.REACT_APP_SOCKET_URL || "http://127.0.0.1:4001";

function Home({ setLoadClient }) {
	// payload: { algo, algoLabel, signals, total, matched, updatedAt }
	const [payload, setPayload]       = useState(null);
	const [streamInfo, setStreamInfo] = useState(null); // { algo, algoLabel, instruments }

	useEffect(() => {
		const socket = socketIOClient(ENDPOINT);

		socket.on("connect_error", (err) => {
			console.error("Socket connect error:", err.message);
		});

		socket.on("FromAPI", (data) => {
			setPayload(data);
		});

		return () => {
			socket.disconnect();
			setLoadClient(false);
		};
	}, [setLoadClient]);

	const signals  = payload?.signals  || [];
	const total    = payload?.total    ?? 0;
	const matched  = payload?.matched  ?? 0;
	const algoLabel = payload?.algoLabel || streamInfo?.algoLabel || "";
	const updatedAt = payload?.updatedAt || "";

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
								<Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent='space-between'>
									<Box>
										<Typography variant='h6' fontWeight={700}>
											{algoLabel || "Select an algorithm"}
										</Typography>
										<Typography variant='body2' color='text.secondary'>
											Realtime market signals dashboard
										</Typography>
									</Box>
									<Typography variant='body2' color='text.secondary' sx={{ alignSelf: "center" }}>
										{matched} signal{matched !== 1 ? "s" : ""} from {total} stocks
										{updatedAt ? ` · ${updatedAt}` : ""}
									</Typography>
								</Stack>
							</Paper>

							{signals.length > 0 ? (
								<Grid container spacing={2}>
									{signals.map((stock) => (
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
