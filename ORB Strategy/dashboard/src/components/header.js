// @ts-nocheck
import React from "react";
import { AppBar, Box, Toolbar, Typography, Chip } from "@mui/material";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";

function Header() {
	return (
		<AppBar
			position='sticky'
			elevation={0}
			sx={{
				background: "rgba(13, 17, 23, 0.78)",
				backdropFilter: "blur(8px)",
				borderBottom: "1px solid",
				borderColor: "divider",
			}}
		>
			<Toolbar sx={{ minHeight: 70 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1 }}>
					<QueryStatsRoundedIcon color='primary' />
					<Typography variant='h6' sx={{ fontWeight: 700 }}>
						IntraTrade Signals
					</Typography>
				</Box>
				<Chip
					label='Realtime Dashboard'
					size='small'
					color='primary'
					variant='outlined'
				/>
			</Toolbar>
		</AppBar>
	);
}

export default Header;
