const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// En production, refuser de démarrer avec des secrets absents ou par défaut
if (process.env.NODE_ENV === 'production') {
  const missing = ['net_Secret', 'SESSION_SECRET'].filter(
    (key) => !process.env[key] || process.env[key] === 'default_session_secret'
  );
  if (missing.length > 0) {
    throw new Error(`Secrets manquants en production : ${missing.join(', ')}`);
  }
}
const prisma = require('./config/db');

const adminRouter = require('./src/routes/adminRouter');
const { isActiveUser } = require('./src/middlewares/isActiveUser');

const usersRouter = require('./src/routes/usersRouter');
const categorieRouter = require('./src/routes/categorieRouter');
const suppliersRouter = require('./src/routes/suppliersRouter');
const productRouter = require('./src/routes/productRouter');
const mouvmentRouter = require('./src/routes/mouvmentRouter');
const clientRouter = require('./src/routes/clientRouter');
const companyRouter = require('./src/routes/companyRouter');
const invoiceRouter = require('./src/routes/invoiceRouter');
const quoteRouter = require('./src/routes/quoteRouter');
const dashboardRouter = require('./src/routes/dashboardRouter');
const managerRouter = require('./src/routes/managerRouter');
const healthRouter = require('./src/routes/healthRouter');
const exportRouter = require('./src/routes/exportRouter');
const teamRouter = require('./src/routes/teamRouter');

const app = express();

// Derrière un proxy (Vercel, Nginx…) : l'IP réelle sert aux limites de débit
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

// En-têtes de sécurité HTTP (API JSON : pas de CSP de page nécessaire)
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } })
);

app.use(logger('dev'));
app.use(
  cors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:5174').split(','),
    credentials: true,
    // Nom de fichier des exports CSV lisible par le navigateur
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax' },
  })
);

// Middleware global : users suspendus → lecture seule (bloque POST/PUT/PATCH/DELETE)
app.use(isActiveUser);

app.use('/api/users', usersRouter); // test valid
app.use('/api/categories', categorieRouter); // test valid
app.use('/api/suppliers', suppliersRouter); //test valid
app.use('/api/products', productRouter); // test valid
app.use('/api/mouvments', mouvmentRouter);
app.use('/api/clients', clientRouter);
app.use('/api/company', companyRouter); // test valid
app.use('/api/invoices', invoiceRouter);
app.use('/api/quotes', quoteRouter);
app.use('/api/dashboard/manager', managerRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);
app.use('/api/exports', exportRouter);
app.use('/api/team', teamRouter);
app.use('/health', healthRouter); // test valid

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const http = require('http');
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Only start the server when run directly (not when imported by tests)
if (require.main === module) {
  prisma
    .$connect()
    .then(() => {
      console.log(' Connecté avec succès à la base de données MySQL !');
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error(' Erreur de connexion à la base de données :', err);
      process.exit(1);
    });
}

module.exports = app;
