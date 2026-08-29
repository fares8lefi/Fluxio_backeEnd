const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
require("dotenv").config();
const prisma = require("./config/db");

const usersRouter = require("./src/routes/usersRouter");
const categorieRouter = require("./src/routes/categorieRouter");
const suppliersRouter = require("./src/routes/suppliersRouter");
const productRouter = require("./src/routes/productRouter");
const mouvmentRouter = require("./src/routes/mouvmentRouter");
const clientRouter = require("./src/routes/clientRouter");
const companyRouter = require("./src/routes/companyRouter");


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
app.use("/api/clients", clientRouter);
app.use("/api/company", companyRouter);


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

prisma.$connect()
  .then(() => {
    console.log(" Connecté avec succès à la base de données MySQL !");
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(" Erreur de connexion à la base de données :", err);
    process.exit(1);
  });

module.exports = app;
