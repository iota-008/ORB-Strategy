// @ts-nocheck
require("dotenv").config();

const { urlencoded } = require("express");
const express = require("express");
const cors = require("cors");

const routes = require("./routes/index");

const app = express();
const PORT = Number(process.env.PORT || 8001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

app.use(
	cors({
		origin: CLIENT_ORIGIN,
		credentials: true,
	})
);
app.use(urlencoded({ extended: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
	res.status(200).json({ status: "ok" });
});

app.use("/", routes);

app.use((err, _req, res, _next) => {
	console.error("Unhandled server error:", err);
	res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, function (err) {
	if (err) {
		return console.log("Error occurred while starting the app:", err);
	}
	return console.log("App has been started on PORT:", PORT);
});
