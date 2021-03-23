// @ts-nocheck
var KiteConnect = require("kiteconnect").KiteConnect;
var KiteTicker = require("kiteconnect").KiteTicker;

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const port = 4001;

const app = express();
module.exports.login = async (req, res) => {
	var requestToken = req.params.requestToken;

	const apiKey = process.env.API_KEY,
		apiSecret = process.env.API_SECRET;

	var options = {
		api_key: apiKey,
	};

	var kc = new KiteConnect(options);
	kc.generateSession(requestToken, apiSecret)
		.then(function (response) {
			accessToken = response?.access_token;
			return res.send({ accessToken: accessToken });
		})
		.catch(function (err) {
			console.log("error : ", err);
			return err.message;
		});
};

module.exports.getData = (req, res) => {
	var data;
	var items = [
		738561,
		2953217,
		408065,
		895745,
		341249,
		779521,
		5582849,
		3851265,
		3529217,
		215553,
		2813441,
		590337,
		7401729,
		3917569,
		2022913,
		693505,
		4451329,
		2815745,
		912129,
		424961,
		4267265,
		4704769,
	];
	const companyData = {
		738561: {
			name: "Reliance",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		2953217: {
			name: "TCS",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		408065: {
			name: "Infosys",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		895745: {
			name: "TataSteel",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		341249: {
			name: "HDFC Bank",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		779521: {
			name: "SBIN",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		5582849: {
			name: "SBI LIFE",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		3851265: {
			name: "Delta Corpo",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		3529217: {
			name: "Tornt Power",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		215553: {
			name: "DHFL",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		2813441: {
			name: "Radico",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		590337: {
			name: "Bestagro",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		7401729: {
			name: "RosselInd",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		3917569: {
			name: "Bang",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		2022913: {
			name: "LIFC",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		693505: {
			name: "MTAR",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		4451329: {
			name: "Adani Power",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		2815745: {
			name: "Maruti Suzuki",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		912129: {
			name: "Adani Green",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		424961: {
			name: "ITC",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		4267265: {
			name: "Bajaj Auto",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
		4704769: {
			name: "Future Retail",
			high: Number.MIN_SAFE_INTEGER,
			low: Number.MAX_SAFE_INTEGER,
		},
	};

	var access_token = req.params.accessToken;

	let interval;

	const server = http.createServer(app);
	const io = socketIo(server, {
		cors: {
			origin: "http://localhost:3000",
			methods: ["GET", "POST"],
		},
	});
	const server1Sockets = new Set();

	var ticker = new KiteTicker({
		api_key: process.env.API_KEY,
		access_token: access_token,
	});

	io.on("connection", (socket) => {
		ticker.connect();
		console.log("New client connected");

		if (interval) {
			clearInterval(interval);
		}
		server1Sockets.add(socket);
		interval = setInterval(() => getApiAndEmit(socket, data), 2000);
		socket.on("disconnect", () => {
			server1Sockets.delete(socket);
			ticker.disconnect();
			clearInterval(interval);
			console.log("Client disconnected");
		});
	});

	const getApiAndEmit = (socket, data) => {
		socket.emit("FromAPI", data);
	};

	//market timings
	const StartTime = "09:15:00";
	const CloseTime = "09:30:00";

	//getting realtime data
	function onTicks(ticks) {
		var currentTime = new Date().toLocaleTimeString("en-GB", {
			hour12: false,
		});
		console.log("currentTime: ", currentTime);

		for (let i = 0; i < ticks.length; i++) {
			var instrumentToken = ticks[i].instrument_token;

			var ltp = ticks[i].last_price;
			console.log("");
			console.log("Name : " + companyData[instrumentToken].name);
			console.log("High : " + companyData[instrumentToken].high);
			console.log("Low : " + companyData[instrumentToken].low);
			console.log("Last Trading Price : " + ltp);
			console.log("");
			if (currentTime >= StartTime && currentTime <= CloseTime) {
				if (ltp > companyData[instrumentToken].high) {
					companyData[instrumentToken].high = ltp;
				}
				if (ltp < companyData[instrumentToken].low) {
					companyData[instrumentToken].low = ltp;
				}
			}

			companyData[instrumentToken].lastTradePrice = ltp;

			if (ltp > companyData[instrumentToken].high) {
				companyData[instrumentToken].status = "Buy";
				companyData[instrumentToken].stoploss =
					companyData[instrumentToken].low;
			} else if (ltp < companyData[instrumentToken].low) {
				companyData[instrumentToken].status = "Sell";
				companyData[instrumentToken].stoploss =
					companyData[instrumentToken].high;
			} else {
				companyData[instrumentToken].status = "Hold";
				companyData[instrumentToken].stoploss = 0;
			}
		}

		data = [];

		for (var i = 0; i < items.length; i++) {
			data.push(companyData[items[i]]);
		}
	}
	function subscribe() {
		ticker.subscribe(items);
		ticker.setMode(ticker.modeFull, items);
	}

	function disconnect() {
		ticker.disconnect();
		console.log("disconnected");
	}

	//starting connection between server and client
	function destroySockets(sockets) {
		for (const socket of sockets.values()) {
			socket.destroy();
		}
	}

	server.listen(port, () => {
		console.log("closing port");
		destroySockets(server1Sockets);
		console.log(`Listening on port ${port}`);
	});

	//ticker functions
	ticker.autoReconnect(true, 10, 5);
	ticker.on("ticks", onTicks);
	ticker.on("connect", subscribe);
	ticker.on("disconnect", disconnect);
	ticker.on("reconnecting", function (reconnect_interval, reconnections) {
		console.log(
			"Reconnecting: attempet - ",
			reconnections,
			" innterval - ",
			reconnect_interval
		);
	});
};
