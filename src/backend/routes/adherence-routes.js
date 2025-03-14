// src/backend/routes/adherence-routes.js
const express = require('express');
const router = express.Router();
const adherenceController = require('../controllers/adherence-controller');

// Rota para calcular aderência
router.post('/calculate', adherenceController.calculateAdherence);

// Rota para listar resultados
router.get('/', adherenceController.listAdherenceResults);

module.exports = router;