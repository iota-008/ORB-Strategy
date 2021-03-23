// @ts-nocheck
import "./App.css";

import React, { useEffect, useState } from "react";
import Home from "./components/home";
import MarketClosedPage from "./components/MarketClosedPage";

function App() {
	const [loadClient, setLoadClient] = useState(true);
	const [marketClosed, setMarketStatus] = useState(false);
	const Holidays = [
		"1/26/2021",
		"3/11/2021",
		"3/29/2021",
		"4/2/2021",
		"4/14/2021",
		"4/21/2021",
		"5/13/2021",
		"7/21/2021",
		"8/19/2021",
		"10/9/2021",
		"10/15/2021",
		"11/4/2021",
		"11/5/2021",
		"11/19/2021",
	];
	const StartTime = "09:15:00";
	const CloseTime = "15:30:00";

	const CheckMarketStatus = () => {
		var currentDate = new Date().toLocaleDateString("en-GB", {
			hour12: false,
		});
		var currentTime = new Date().toLocaleTimeString("en-GB", {
			hour12: false,
		});

		if (
			Holidays.includes(currentDate) ||
			currentTime < StartTime ||
			currentTime > CloseTime
		) {
			<div className='alert alert-danger fade in alert-dismissible'>
				Market Is Closed
			</div>;
			setMarketStatus(true);
			setLoadClient(false);
		} else {
			<div className='alert alert-success fade in alert-dismissible'>
				Market Is Open
			</div>;
			setLoadClient((prevState) => !prevState);
		}

		// console.log(marketClosed);
		// console.log(loadClient);
		// console.log(localStorage.getItem("accessToken") != null);
	};
	useEffect(() => {
		CheckMarketStatus();
	}, []);
	return (
		<>
			{loadClient && !marketClosed ? (
				<Home setLoadClient={setLoadClient} />
			) : (
				<MarketClosedPage marketStatus={marketClosed} />
			)}
			{!marketClosed ? (
				<button
					className='btn btn-lg btn-primary align-self-center mb-3  mt-3 mx-auto d-block'
					onClick={CheckMarketStatus}
				>
					{loadClient ? "Disconnect" : "Connect"}
				</button>
			) : null}
		</>
	);
}

export default App;
