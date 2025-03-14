// src/backend/controllers/backtesting-controller.js
const backtestingService = require('../services/backtesting-service');
const logger = require('../utils/logger');

class BacktestingController {
  // Importar backtest
  async importBacktest(req, res) {
    try {
      // Note: Esta é uma simplificação. Em produção, use multer para upload de arquivos
      if (!req.body.fileData || !req.body.fileName || !req.body.eaId) {
        return res.status(400).json({ error: 'Dados do arquivo e ID do EA são obrigatórios' });
      }
      
      const { fileData, fileName, eaId } = req.body;
      
      // Converter string base64 para buffer (simplificado)
      const fileBuffer = Buffer.from(fileData, 'base64');
      
      const result = await backtestingService.importBacktest(fileBuffer, fileName, eaId);
      
      return res.status(200).json({
        success: true,
        message: 'Backtesting importado com sucesso',
        backtest: result
      });
    } catch (error) {
      logger.error(`Erro ao importar backtest: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Listar backtests
  async listBacktests(req, res) {
    try {
      const { eaId } = req.query;
      const backtests = await backtestingService.listBacktests(eaId);
      return res.status(200).json(backtests);
    } catch (error) {
      logger.error(`Erro ao listar backtests: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new BacktestingController();