// src/backend/controllers/ea-controller.js
const eaService = require('../services/ea-service');
const logger = require('../utils/logger');

class EAController {
  // Listar todos os EAs
  async listEAs(req, res) {
    try {
      const eas = await eaService.listEAs();
      return res.status(200).json(eas);
    } catch (error) {
      logger.error(`Erro ao listar EAs: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Obter detalhes de um EA
  async getEA(req, res) {
    try {
      const { eaId } = req.params;
      
      if (!eaId) {
        return res.status(400).json({ error: 'ID do EA é obrigatório' });
      }
      
      const ea = await eaService.getEADetails(eaId);
      return res.status(200).json(ea);
    } catch (error) {
      logger.error(`Erro ao obter EA: ${error.message}`);
      
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({ error: error.message });
      }
      
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new EAController();