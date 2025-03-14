// src/backend/services/adherence-service.js
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class AdherenceService {
  constructor() {
    this.dataDir = path.resolve('./src/data');
    this.processedDir = path.join(this.dataDir, 'processed', 'adherence');
    this.rawDir = path.join(this.dataDir, 'raw');
    this.extractionsDir = path.join(this.rawDir, 'extractions');
    this.backtestsDir = path.join(this.rawDir, 'backtests');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.processedDir, { recursive: true });
      await fs.mkdir(this.extractionsDir, { recursive: true });
      await fs.mkdir(this.backtestsDir, { recursive: true });
    } catch (error) {
      logger.error(`Erro ao criar diretórios: ${error.message}`);
    }
  }

  /**
   * Calcula a aderência entre operações reais e de backtest
   */
  async calculateAdherence(eaId, extractionId, backtestId) {
    try {
      await this.ensureDirectories();
      
      logger.info(`Calculando aderência para EA ${eaId}`);
      
      // Aqui implementaríamos a lógica real de leitura de arquivos e cálculo
      // Versão simplificada para demonstração
      
      // Simular o resultado do cálculo
      const result = {
        eaId,
        extractionId,
        backtestId,
        timestamp: new Date().toISOString(),
        totalRealOperations: 120,
        totalBacktestOperations: 125,
        matchedOperations: 115,
        adherenceRate: 92.0,
        approved: true,
        slippageAvg: 0.15,
        unmatchedBacktest: 10,
        unmatchedReal: 5
      };
      
      // No MVP, salvar apenas o JSON com o resultado
      const resultId = `adherence_${eaId}_${Date.now()}`;
      const resultPath = path.join(this.processedDir, `${resultId}.json`);
      
      await this.ensureDirectories();
      await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
      
      return result;
    } catch (error) {
      logger.error(`Erro ao calcular aderência: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Lista resultados de aderência 
   */
  async listAdherenceResults(eaId = null) {
    try {
      await this.ensureDirectories();
      
      // Simular resultados para MVP
      return [
        {
          eaId: "ea1",
          timestamp: new Date().toISOString(),
          adherenceRate: 92.0,
          totalRealOperations: 120,
          slippageAvg: 0.15,
          approved: true
        },
        {
          eaId: "ea2",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          adherenceRate: 87.5,
          totalRealOperations: 200,
          slippageAvg: 0.23,
          approved: false
        }
      ].filter(item => !eaId || item.eaId === eaId);
    } catch (error) {
      logger.error(`Erro ao listar resultados: ${error.message}`);
      return [];
    }
  }
}

module.exports = new AdherenceService();