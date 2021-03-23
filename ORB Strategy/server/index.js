// @ts-nocheck
const { urlencoded } = require("express");
const express = require("express");

const routes = require("./routes/index");

const app = express();
const PORT = 8001;

const cors = require("cors");

app.use(
	cors({
		origin: "http://localhost:3000",
		credentials: true,
	})
);
app.use(urlencoded({ extended: true }));
app.use(express.json());
app.use("/", routes);

app.listen(PORT, function (err) {
	if (err) {
		return console.log("Error Occured while starting the app: ", err);
	}
	return console.log("App has been started on PORT: ", PORT);
});
