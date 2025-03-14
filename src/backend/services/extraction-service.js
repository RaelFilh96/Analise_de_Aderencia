// src/backend/services/extraction-service.js

const zmqClient = require('../zmq-client').getInstance();
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config/default');
const { v4: uuidv4 } = require('uuid');

class ExtractionService {
  constructor() {
    this.dataDir = path.resolve(config.storage.dataDir);
    this.extractionsDir = path.join(this.dataDir, 'raw', 'extractions');
    this.activeExtractions = new Map(); // Map para monitorar extrações ativas
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.extractionsDir, { recursive: true });
    } catch (error) {
      logger.error(`Erro ao criar diretórios: ${error.message}`);
      throw error;
    }
  }

  async startExtraction(startDate, endDate = null) {
    try {
      await this.ensureDirectories();
      
      // Formato das datas para ISO string
      const formattedStartDate = new Date(startDate).toISOString();
      const formattedEndDate = endDate ? new Date(endDate).toISOString() : null;
      
      // ID único para esta extração
      const extractId = `extract_${uuidv4()}`;
      
      // Inicia extração no servidor MT5
      const response = await zmqClient.extractData(
        formattedStartDate, 
        formattedEndDate, 
        extractId
      );
      
      if (!response.success) {
        throw new Error(`Falha ao iniciar extração: ${response.error || 'Erro desconhecido'}`);
      }
      
      // Registra extração ativa para monitoramento
      this.activeExtractions.set(extractId, {
        id: extractId,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        startTime: new Date(),
        status: 'extracting',
        progress: 0
      });
      
      logger.info(`Extração iniciada: ${extractId}`);
      return { extractId, message: 'Extração iniciada com sucesso' };
      
    } catch (error) {
      logger.error(`Erro ao iniciar extração: ${error.message}`);
      throw error;
    }
  }

  async getExtractionStatus(extractId) {
    try {
      // Verifica status no servidor MT5
      const response = await zmqClient.getExtractionStatus({ extract_id: extractId });
      
      if (!response.success) {
        // Se não conseguiu obter via ZMQ, verifica se temos o arquivo localmente
        try {
          const metadataPath = path.join(this.extractionsDir, `${extractId}_metadata.json`);
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
          return {
            id: extractId,
            status: 'completed',
            progress: 100,
            metadata
          };
        } catch (fileError) {
          // Arquivo não existe ou não pode ser lido
          throw new Error(`Extração ${extractId} não encontrada`);
        }
      }
      
      // Atualiza mapa de extrações ativas
      if (response.status) {
        if (this.activeExtractions.has(extractId)) {
          this.activeExtractions.set(extractId, {
            ...this.activeExtractions.get(extractId),
            ...response.status
          });
        }
        
        // Se extração completa, remove do mapa ativo após algum tempo
        if (response.status.status === 'completed' || response.status.status === 'error') {
          setTimeout(() => {
            this.activeExtractions.delete(extractId);
          }, 60000); // Remove após 1 minuto
        }
      }
      
      return response.status;
      
    } catch (error) {
      logger.error(`Erro ao obter status da extração ${extractId}: ${error.message}`);
      throw error;
    }
  }

  async cancelExtraction(extractId) {
    try {
      if (!this.activeExtractions.has(extractId)) {
        throw new Error(`Extração ${extractId} não está ativa`);
      }
      
      const response = await zmqClient.cancelExtraction({ extract_id: extractId });
      
      if (!response.success) {
        throw new Error(`Falha ao cancelar extração: ${response.error || 'Erro desconhecido'}`);
      }
      
      // Atualiza status no mapa local
      if (this.activeExtractions.has(extractId)) {
        const extraction = this.activeExtractions.get(extractId);
        extraction.status = 'cancelled';
        this.activeExtractions.set(extractId, extraction);
        
        // Remove do mapa após algum tempo
        setTimeout(() => {
          this.activeExtractions.delete(extractId);
        }, 60000); // Remove após 1 minuto
      }
      
      return { message: 'Extração cancelada com sucesso' };
      
    } catch (error) {
      logger.error(`Erro ao cancelar extração ${extractId}: ${error.message}`);
      throw error;
    }
  }

  async listActiveExtractions() {
    return Array.from(this.activeExtractions.values());
  }

  async listCompletedExtractions() {
    try {
      const files = await fs.readdir(this.extractionsDir);
      const metadataFiles = files.filter(file => file.endsWith('_metadata.json'));
      
      const extractions = await Promise.all(
        metadataFiles.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(this.extractionsDir, file), 'utf8');
            return JSON.parse(content);
          } catch (error) {
            logger.warn(`Erro ao ler arquivo ${file}: ${error.message}`);
            return null;
          }
        })
      );
      
      return extractions.filter(Boolean);
    } catch (error) {
      logger.error(`Erro ao listar extrações concluídas: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ExtractionService();