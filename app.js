const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
require("dotenv").config();

const usersRouter = require("./routes/usersRouter");
const categorieRouter = require("./routes/categorieRouter");
const suppliersRouter = require("./routes/suppliersRouter");
const productRouter = require("./routes/productRouter");
const mouvmentRouter = require("./routes/mouvmentRouter");


const { connectToDb } = require("./config/db");

const app = express();


app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, 
  })
);


app.use(express.static(path.join(__dirname, "public")));


app.use("/api/users", usersRouter);
app.use("/api/categories", categorieRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/products", productRouter);
app.use("/api/mouvments", mouvmentRouter);


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});


app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});


const http = require("http");
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", async () => {
  await connectToDb();
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
