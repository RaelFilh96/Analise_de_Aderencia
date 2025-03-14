// src/backend/controllers/extraction-controller.js

const extractionService = require('../services/extraction-service');
const logger = require('../utils/logger');

class ExtractionController {
  // Iniciar nova extração
  async startExtraction(req, res) {
    try {
      const { startDate, endDate } = req.body;
      
      if (!startDate) {
        return res.status(400).json({ error: 'Data inicial é obrigatória' });
      }
      
      const result = await extractionService.startExtraction(startDate, endDate);
      return res.status(200).json(result);
    } catch (error) {
      logger.error(`Erro ao iniciar extração: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Obter status de uma extração específica
  async getExtractionStatus(req, res) {
    try {
      const { extractId } = req.params;
      
      if (!extractId) {
        return res.status(400).json({ error: 'ID de extração é obrigatório' });
      }
      
      const status = await extractionService.getExtractionStatus(extractId);
      return res.status(200).json(status);
    } catch (error) {
      logger.error(`Erro ao obter status da extração: ${error.message}`);
      return res.status(404).json({ error: error.message });
    }
  }
  
  // Cancelar uma extração em andamento
  async cancelExtraction(req, res) {
    try {
      const { extractId } = req.params;
      
      if (!extractId) {
        return res.status(400).json({ error: 'ID de extração é obrigatório' });
      }
      
      const result = await extractionService.cancelExtraction(extractId);
      return res.status(200).json(result);
    } catch (error) {
      logger.error(`Erro ao cancelar extração: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Listar extrações ativas
  async listActiveExtractions(req, res) {
    try {
      const extractions = await extractionService.listActiveExtractions();
      return res.status(200).json(extractions);
    } catch (error) {
      logger.error(`Erro ao listar extrações ativas: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Listar extrações concluídas
  async listCompletedExtractions(req, res) {
    try {
      const extractions = await extractionService.listCompletedExtractions();
      return res.status(200).json(extractions);
    } catch (error) {
      logger.error(`Erro ao listar extrações concluídas: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ExtractionController();