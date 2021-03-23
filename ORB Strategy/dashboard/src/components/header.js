// @ts-nocheck

import Logo from "../images/logo.png";
import React from "react";
import VerzeoLogo from "../images/verzeo.png";
import style from "./styles.module.css";

function Header() {
	return (
		<div className={style.logo}>
			<img className={style.foxTradingLogo} src={Logo} alt='logo' />
			<img className={style.verzeoLogo} src={VerzeoLogo} alt='verzeo logo' />
			<br />
		</div>
	);
}

export default Header;
