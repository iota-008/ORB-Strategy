// @ts-nocheck

// import RIL_Logo from "../images/RIL_Logo.png";
import React, { useState, useEffect } from "react";
import style from "./styles.module.css";

function Stocks1({ stock }) {
	// console.log(stock);

	const [color, setColor] = useState("White");

	useEffect(() => {
		var target = document.getElementById("stock-action");

		// create an observer instance
		var observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (mutation) {
				// console.info("EVENT TRIGGERT " + mutation.target.id);
			});
		});

		// configuration of the observer:
		var config = { attributes: true, childList: true, characterData: true };

		// pass in the target node, as well as the observer options
		observer.observe(target, config);

		// simulate the Change of the text value of span
		function simulateChange() {
			var action = target.innerText;

			if (action === "Sell") {
				setColor("Red");
			} else if (action === "Buy") {
				setColor("Green");
			} else {
				setColor("White");
			}
		}

		setInterval(simulateChange, 2000);
	}, []);

	return (
		<div className={style.section}>
			<style>{`#${stock?.name} {background-color: " + color + ";}`}</style>
			<h1 className={style.companyName}>{stock?.name}</h1>

			<div className={style.container}>
				<div>
					<p className={style.status}>Action</p>
					<span className={style.data} id={stock?.name}>
						{stock?.status}
					</span>
				</div>

				<div>
					<p className={style.status}>High</p>
					<span className={style.data}> {stock?.high}</span>
				</div>

				<div>
					<p className={style.status}>Low</p>
					<span className={style.data}> {stock?.low}</span>
				</div>

				<div>
					<p className={style.status}>Last Trading Price</p>
					<span className={style.data}>{stock?.lastTradePrice}</span>
				</div>

				<div>
					<p className={style.status}>StopLoss </p>
					<span className={style.data}>{stock?.stoploss}</span>
				</div>
			</div>
		</div>
	);
}

export default Stocks1;
