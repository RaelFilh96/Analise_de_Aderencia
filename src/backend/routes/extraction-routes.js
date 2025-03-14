// src/backend/routes/extraction-routes.js

const express = require('express');
const router = express.Router();
const extractionController = require('../controllers/extraction-controller');

// Rota para iniciar extração
router.post('/', extractionController.startExtraction);

// Rota para listar extrações ativas
router.get('/active', extractionController.listActiveExtractions);

// Rota para listar extrações concluídas
router.get('/completed', extractionController.listCompletedExtractions);

// Rota para obter status de uma extração
router.get('/:extractId', extractionController.getExtractionStatus);

// Rota para cancelar extração
router.delete('/:extractId', extractionController.cancelExtraction);

module.exports = router;