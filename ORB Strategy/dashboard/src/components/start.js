// @ts-nocheck

import React, { useState } from "react";
import axios from "axios";

function Start() {
	const [token, setToken] = useState("");
	const [showLogin, setLogin] = useState(true);
	const [showGetToken, setGetToken] = useState(false);
	const [showStart, setStart] = useState(false);
	const getToken = () => {
		const url = "https://kite.trade/connect/login?api_key=6zfi2amoxjco04yo&v=3";

		window.open(url, "_blank");

		setLogin(false);
		setGetToken(true);
		return false;
	};

	const handleInput = (e) => {
		setToken(e.target.value);
	};
	const sendToken = async () => {
		console.log(token);
		await axios
			.get("http://localhost:8001/api/login/" + token)
			.then((response) => {
				localStorage.setItem("accessToken", response.data.accessToken);
				alert("access token received successfully");

				setGetToken(false);
				setStart(true);
			})
			.catch((err) => console.log("error:", err));
	};

	const start = async () => {
		const token = localStorage.getItem("accessToken");
		if (!token) {
			console.log("Try getting request token again, no access token found");
		} else {
			await axios
				.get("http://localhost:8001/api/data/" + token)
				.then((res) => {
					setStart(false);
				})
				.catch((err) => {
					alert("accesstoken Expired!!!");

					localStorage.removeItem("accessToken");
					console.log(err.message);
				});
			// setStart(false);
		}
	};
	return (
		<div>
			{showLogin && localStorage.getItem("accessToken") == null ? (
				<button
					className='btn btn-primary mt-3 mx-auto d-block'
					onClick={getToken}
				>
					Login
				</button>
			) : null}
			{showGetToken ? (
				<div>
					<input
						className='mt-3 mx-auto d-block w-25'
						placeholder='enter request token'
						value={token}
						onChange={handleInput}
					></input>
					<span> </span>
					<button
						className='btn btn-sm btn-primary mt-3 mx-auto d-block'
						onClick={sendToken}
					>
						Get Access Token
					</button>
				</div>
			) : null}
			{showStart ? (
				<div>
					<span> </span>
					<button
						className='btn btn-lg btn-primary mt-3 mx-auto d-block'
						onClick={start}
					>
						Start
					</button>
				</div>
			) : null}
		</div>
	);
}

export default Start;
