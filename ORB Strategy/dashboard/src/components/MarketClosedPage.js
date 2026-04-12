// @ts-nocheck

import Header from "./header";
import React from "react";
import { Alert, Box, Card, CardContent, Container, Stack, Typography } from "@mui/material";

function MarketClosedPage({ marketStatus }) {
	return (
		<Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
			<Header />
			<Container maxWidth='sm' sx={{ py: 6 }}>
				<Stack spacing={3}>
					{marketStatus ? (
						<Alert severity='error' variant='filled'>
							Market is currently closed
						</Alert>
					) : null}

					<Card variant='outlined'>
						<CardContent>
							<Typography variant='h5' fontWeight={700} gutterBottom>
								Market Timings
							</Typography>
							<Typography variant='body1' color='text.secondary'>
								Monday to Friday
							</Typography>
							<Typography variant='h6' sx={{ mt: 1.5 }}>
								09:15 AM to 03:30 PM (IST)
							</Typography>
							<Typography variant='body2' color='text.secondary' sx={{ mt: 1.5 }}>
								Closed on weekends and exchange holidays.
							</Typography>
						</CardContent>
					</Card>
				</Stack>
			</Container>
		</Box>
	);
}

export default MarketClosedPage;
