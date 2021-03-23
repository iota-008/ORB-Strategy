// @ts-nocheck

import Header from "./header";
import React from "react";
// import Stocks1 from "./stocks1";

import style from "./styles.module.css";

function MarketClosedPage({ marketStatus }) {
	return (
		<div className='App'>
			<Header />
			{marketStatus ? (
				<div className={style.marketClosed}>Market Closed</div>
			) : null}

			<br></br>
			<div className={style.closed}>
				<h1>Market Timings</h1>
				<h2>Monday to Friday</h2>
				<h3>9:15 AM to 3:30 PM</h3>
				<h4>* Closed on weekends and holidays</h4>
			</div>

			<br></br>
		</div>
	);
}

export default MarketClosedPage;
