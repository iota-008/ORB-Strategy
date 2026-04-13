// @ts-nocheck

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";

function KiteCallback({ apiBaseUrl }) {
	const [status, setStatus] = useState("loading");
	const [message, setMessage] = useState("Completing Kite login...");

	const requestToken = useMemo(() => {
		const params = new URLSearchParams(window.location.search);
		return (params.get("request_token") || "").trim();
	}, []);

	useEffect(() => {
		let cancelled = false;

		const finishLogin = async () => {
			if (!requestToken) {
				setStatus("error");
				setMessage("Missing request token in Kite redirect URL.");
				return;
			}

			try {
				const res = await axios.post(`${apiBaseUrl}/api/login`, {
					requestToken,
				});

				if (cancelled) return;

				const accessToken = res.data?.accessToken || "";
				if (!accessToken) {
					throw new Error("Server did not return access token");
				}

				localStorage.setItem("accessToken", accessToken);
				setStatus("success");
				setMessage("Kite login successful. Redirecting back to dashboard...");

				setTimeout(() => {
					window.location.replace("/");
				}, 1200);
			} catch (err) {
				if (cancelled) return;
				setStatus("error");
				setMessage(err?.response?.data?.error || err.message || "Unable to complete Kite login");
			}
		};

		finishLogin();

		return () => {
			cancelled = true;
		};
	}, [apiBaseUrl, requestToken]);

	return (
		<Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2, bgcolor: "background.default" }}>
			<Paper variant='outlined' sx={{ p: 4, width: "100%", maxWidth: 520, borderRadius: 3 }}>
				<Stack spacing={2} alignItems='center'>
					{status === "loading" ? <CircularProgress /> : null}
					<Typography variant='h5' fontWeight={700} textAlign='center'>
						Kite Authentication
					</Typography>
					<Alert severity={status === "success" ? "success" : status === "error" ? "error" : "info"} sx={{ width: "100%" }}>
						{message}
					</Alert>
					{status === "error" ? (
						<Button variant='contained' onClick={() => window.location.replace("/")}>
							Back to Dashboard
						</Button>
					) : null}
				</Stack>
			</Paper>
		</Box>
	);
}

export default KiteCallback;