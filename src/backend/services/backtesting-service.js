// src/backend/services/backtesting-service.js
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class BacktestingService {
  constructor() {
    this.dataDir = path.resolve('./src/data');
    this.backtestsDir = path.join(this.dataDir, 'raw/backtests');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.backtestsDir, { recursive: true });
    } catch (error) {
      logger.error(`Erro ao criar diretório: ${error.message}`);
    }
  }

  /**
   * Importa arquivo de backtesting
   */
  async importBacktest(fileBuffer, fileName, eaId) {
    try {
      await this.ensureDirectories();
      
      // No MVP, simulamos processamento bem-sucedido
      const backtestId = `backtest_${eaId}_${Date.now()}`;
      
      logger.info(`Importação simulada: ${backtestId}`);
      
      return {
        id: backtestId,
        eaId,
        fileName,
        timestamp: new Date().toISOString(),
        operations: 150
      };
    } catch (error) {
      logger.error(`Erro ao importar backtest: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lista backtests
   */
  async listBacktests(eaId = null) {
    try {
      await this.ensureDirectories();
      
      // Dados mockados para MVP
      const backtests = [
        {
          id: "bt1",
          eaId: "ea1",
          fileName: "backtest_jan_2025.csv",
          timestamp: new Date(Date.now() - 5*86400000).toISOString(),
          operations: 120
        },
        {
          id: "bt2",
          eaId: "ea2",
          fileName: "backtest_feb_2025.csv",
          timestamp: new Date(Date.now() - 3*86400000).toISOString(),
          operations: 210
        }
      ];
      
      return backtests.filter(bt => !eaId || bt.eaId === eaId);
    } catch (error) {
      logger.error(`Erro ao listar backtests: ${error.message}`);
      return [];
    }
  }
}

module.exports = new BacktestingService();