const express = require('express');
const request = require('supertest');

describe('loginLimiter', () => {
  const previousEnv = process.env.NODE_ENV;
  // Les limiteurs sont désactivés en NODE_ENV=test : on les réactive ici
  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });
  afterAll(() => {
    process.env.NODE_ENV = previousEnv;
  });

  it('bloque la 11e tentative de connexion avec un 429', async () => {
    const { loginLimiter } = require('../../../src/middlewares/rateLimiters');
    const app = express();
    app.post('/login', loginLimiter, (req, res) => res.status(401).json({ success: false }));

    for (let i = 0; i < 10; i++) {
      await request(app).post('/login').expect(401);
    }
    const blocked = await request(app).post('/login').expect(429);
    expect(blocked.body.message).toMatch(/Trop de tentatives/);
  });
});
