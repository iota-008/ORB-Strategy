// @ts-nocheck
import React, { useEffect, useState } from "react";
import Header from "./header";
import Start from "./start";
import Stocks from "./stocks";

import socketIOClient from "socket.io-client";

const ENDPOINT = "http://127.0.0.1:4001";
function Home({ setLoadClient }) {
	const [response, setResponse] = useState([]);
	const [showStart] = useState(true);
	useEffect(() => {
		const socket = socketIOClient(ENDPOINT);

		// setStart(false);
		console.log("reconnecting");
		socket.on("connect_error", (err) => {
			// console.log(err instanceof Error); // true
			console.error(err.message); // not authorized
			// localStorage.removeItem("accessToken");
			// console.log(err.data); // { content: "Please retry later" }
		});
		socket.on("FromAPI", (data) => {
			// console.log(data);
			setResponse(data);
		});

		// setStart(true);

		// CLEAN UP THE EFFECT
		return () => {
			socket.disconnect();
			setLoadClient(false);
			console.log("disconnected");
		};

		//
	}, []);
	// console.log(response);

	return (
		<div className='App'>
			<Header />

			{response ? (
				response.map((stock) => {
					return <Stocks key={stock?.name} stock={stock} />;
				})
			) : (
				<h1>Don't know what happended</h1>
			)}

			{showStart ? <Start /> : null}
		</div>
	);
}

export default Home;
