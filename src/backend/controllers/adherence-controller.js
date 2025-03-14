// src/backend/controllers/adherence-controller.js
const adherenceService = require('../services/adherence-service');
const logger = require('../utils/logger');

class AdherenceController {
  // Calcular aderência
  async calculateAdherence(req, res) {
    try {
      const { eaId, extractionId, backtestId } = req.body;
      
      if (!eaId || !extractionId || !backtestId) {
        return res.status(400).json({ error: 'IDs do EA, extração e backtest são obrigatórios' });
      }
      
      const result = await adherenceService.calculateAdherence(eaId, extractionId, backtestId);
      return res.status(200).json(result);
    } catch (error) {
      logger.error(`Erro ao calcular aderência: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Listar resultados de aderência
  async listAdherenceResults(req, res) {
    try {
      const { eaId } = req.query;
      const results = await adherenceService.listAdherenceResults(eaId);
      return res.status(200).json(results);
    } catch (error) {
      logger.error(`Erro ao listar resultados: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AdherenceController();