// src/backend/zmq-client/index.js

const zmq = require('zeromq');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/default');
const logger = require('../utils/logger');

class MT5ZMQClient {
  constructor(endpoint = config.zmq.endpoint) {
    this.endpoint = endpoint;
    this.socket = null;
    this.connected = false;
    this.reconnectInterval = config.zmq.reconnectInterval;
    this.requestTimeout = config.zmq.requestTimeout;
    this.pendingRequests = new Map();
  }

  async connect() {
    try {
      logger.info(`Conectando ao servidor ZeroMQ: ${this.endpoint}`);
      this.socket = new zmq.Request();
      
      // Evento para processar respostas recebidas
      this.socket.receive().then(this._processResponse.bind(this)).catch(this._handleSocketError.bind(this));
      
      // Conecta ao endpoint
      this.socket.connect(this.endpoint);
      this.connected = true;
      
      logger.info('Conectado ao servidor ZeroMQ');
      return true;
    } catch (error) {
      logger.error(`Erro ao conectar ao servidor ZeroMQ: ${error.message}`);
      this.connected = false;
      this._scheduleReconnect();
      return false;
    }
  }

  async _processResponse(message) {
    try {
      // Processa a resposta recebida
      const [responseBuffer] = message;
      const responseData = JSON.parse(responseBuffer.toString());
      
      // Se há ID de requisição, resolve a promessa correspondente
      if (responseData.requestId && this.pendingRequests.has(responseData.requestId)) {
        const { resolve, reject, timer } = this.pendingRequests.get(responseData.requestId);
        clearTimeout(timer);
        this.pendingRequests.delete(responseData.requestId);
        
        resolve(responseData);
      } else {
        logger.warn('Resposta recebida sem requestId correspondente', responseData);
      }
      
      // Continua processando respostas
      this.socket.receive().then(this._processResponse.bind(this)).catch(this._handleSocketError.bind(this));
    } catch (error) {
      logger.error(`Erro ao processar resposta ZeroMQ: ${error.message}`);
      // Continua processando respostas mesmo após erro
      this.socket.receive().then(this._processResponse.bind(this)).catch(this._handleSocketError.bind(this));
    }
  }

  _handleSocketError(error) {
    logger.error(`Erro no socket ZeroMQ: ${error.message}`);
    this.connected = false;
    
    // Rejeita todas as requisições pendentes
    for (const [requestId, { reject, timer }] of this.pendingRequests.entries()) {
      clearTimeout(timer);
      reject(new Error('Conexão ZeroMQ perdida'));
      this.pendingRequests.delete(requestId);
    }
    
    // Agenda reconexão
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    logger.info(`Agendando reconexão em ${this.reconnectInterval}ms`);
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error(`Falha na reconexão: ${error.message}`);
      }
    }, this.reconnectInterval);
  }

  async sendRequest(action, params = {}) {
    if (!this.connected) {
      throw new Error('Cliente ZeroMQ não está conectado');
    }
    
    // Cria ID único para esta requisição
    const requestId = uuidv4();
    
    // Prepara a mensagem
    const request = {
      requestId,
      action,
      ...params,
      timestamp: new Date().toISOString()
    };
    
    // Cria uma promessa que será resolvida quando a resposta chegar
    return new Promise((resolve, reject) => {
      // Define timeout para esta requisição
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Timeout na requisição após ${this.requestTimeout}ms`));
        }
      }, this.requestTimeout);
      
      // Registra a requisição pendente
      this.pendingRequests.set(requestId, { resolve, reject, timer });
      
      // Envia a requisição
      this.socket.send(JSON.stringify(request))
        .catch(error => {
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          reject(error);
        });
    });
  }
  
  // Métodos específicos para comunicação com o servidor MT5
  
  async getStatus() {
    return this.sendRequest('status');
  }
  
  async extractData(startDate, endDate = null, extractId = null) {
    return this.sendRequest('extract', {
      start_date: startDate,
      end_date: endDate,
      extract_id: extractId
    });
  }
  
  async getExtractionStatus(extractId) {
    return this.sendRequest('extract_status', {
      extract_id: extractId
    });
  }
  
  async cancelExtraction(extractId) {
    return this.sendRequest('cancel_extract', {
      extract_id: extractId
    });
  }
  
  async listAccounts() {
    return this.sendRequest('list_accounts');
  }
  
  async selectAccount(login, password = null, server = null) {
    return this.sendRequest('select_account', {
      login,
      password,
      server
    });
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new MT5ZMQClient();
    }
    return instance;
  }
};