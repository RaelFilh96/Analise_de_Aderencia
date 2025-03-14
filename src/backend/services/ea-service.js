// src/backend/services/ea-service.js
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class EAService {
  constructor() {
    this.dataDir = path.resolve('./src/data');
    this.eaDir = path.join(this.dataDir, 'eas');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.eaDir, { recursive: true });
    } catch (error) {
      logger.error(`Erro ao criar diretório: ${error.message}`);
    }
  }

  /**
   * Lista todos os EAs
   */
  async listEAs() {
    await this.ensureDirectories();
    
    // Dados mockados para MVP
    return [
      {
        id: "ea1",
        name: "EA Momentum Trader",
        metrics: {
          adherenceRate: 95,
          operations: 1250,
          slippage: 0.12,
          lastUpdate: new Date().toISOString(),
          trend: [
            { value: 93, timestamp: new Date(Date.now() - 5*86400000).toISOString() },
            { value: 94, timestamp: new Date(Date.now() - 4*86400000).toISOString() },
            { value: 92, timestamp: new Date(Date.now() - 3*86400000).toISOString() },
            { value: 96, timestamp: new Date(Date.now() - 2*86400000).toISOString() },
            { value: 95, timestamp: new Date(Date.now() - 86400000).toISOString() }
          ]
        }
      },
      {
        id: "ea2",
        name: "EA Scalper Pro",
        metrics: {
          adherenceRate: 87,
          operations: 4320,
          slippage: 0.23,
          lastUpdate: new Date().toISOString(),
          trend: [
            { value: 85, timestamp: new Date(Date.now() - 5*86400000).toISOString() },
            { value: 89, timestamp: new Date(Date.now() - 4*86400000).toISOString() },
            { value: 86, timestamp: new Date(Date.now() - 3*86400000).toISOString() },
            { value: 88, timestamp: new Date(Date.now() - 2*86400000).toISOString() },
            { value: 87, timestamp: new Date(Date.now() - 86400000).toISOString() }
          ]
        }
      },
      {
        id: "ea3",
        name: "EA Breakout Master",
        metrics: {
          adherenceRate: 76,
          operations: 870,
          slippage: 0.31,
          lastUpdate: new Date().toISOString(),
          trend: [
            { value: 78, timestamp: new Date(Date.now() - 5*86400000).toISOString() },
            { value: 75, timestamp: new Date(Date.now() - 4*86400000).toISOString() },
            { value: 74, timestamp: new Date(Date.now() - 3*86400000).toISOString() },
            { value: 73, timestamp: new Date(Date.now() - 2*86400000).toISOString() },
            { value: 76, timestamp: new Date(Date.now() - 86400000).toISOString() }
          ]
        }
      }
    ];
  }

  /**
   * Obtém detalhes de um EA específico
   */
  async getEADetails(eaId) {
    const eas = await this.listEAs();
    const ea = eas.find(ea => ea.id === eaId);
    
    if (!ea) {
      throw new Error(`EA não encontrado: ${eaId}`);
    }
    
    return ea;
  }
}

module.exports = new EAService();