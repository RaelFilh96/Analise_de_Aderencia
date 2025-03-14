// src/backend/routes/backtesting-routes.js
const express = require('express');
const router = express.Router();
const backtestingController = require('../controllers/backtesting-controller');

// Rota para importar backtest
router.post('/import', backtestingController.importBacktest);

// Rota para listar backtests
router.get('/', backtestingController.listBacktests);

module.exports = router;