// src/backend/routes/ea-routes.js
const express = require('express');
const router = express.Router();
const eaController = require('../controllers/ea-controller');

// Rota para listar todos os EAs
router.get('/', eaController.listEAs);

// Rota para obter detalhes de um EA
router.get('/:eaId', eaController.getEA);

module.exports = router;