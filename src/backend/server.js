// src/backend/server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/default');
const logger = require('./utils/logger');
const zmqClient = require('./zmq-client').getInstance();

// Importação de rotas
const extractionRoutes = require('./routes/extraction-routes');

// Inicialização do app Express
const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para logging de requisições
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Rotas da API
app.use('/api/extractions', extractionRoutes);

// Rota de status do servidor MT5
app.get('/api/mt5/status', async (req, res) => {
  try {
    const status = await zmqClient.getStatus();
    res.json(status);
  } catch (error) {
    logger.error(`Erro ao obter status do MT5: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Rota para listar contas MT5
app.get('/api/mt5/accounts', async (req, res) => {
  try {
    const result = await zmqClient.listAccounts();
    res.json(result);
  } catch (error) {
    logger.error(`Erro ao listar contas MT5: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Rota para selecionar conta MT5
app.post('/api/mt5/accounts/select', async (req, res) => {
  try {
    const { login, password, server } = req.body;
    if (!login) {
      return res.status(400).json({ error: 'Login é obrigatório' });
    }
    
    const result = await zmqClient.selectAccount(login, password, server);
    res.json(result);
  } catch (error) {
    logger.error(`Erro ao selecionar conta MT5: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Tratamento de rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  logger.error(`Erro não tratado: ${err.message}`);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicializa servidor
async function startServer() {
  try {
    // Conecta ao servidor ZeroMQ
    const connected = await zmqClient.connect();
    if (!connected) {
      logger.warn('Iniciando servidor sem conexão ZeroMQ...');
    }
    
    // Inicia servidor HTTP
    const { port, host } = config.server;
    app.listen(port, host, () => {
      logger.info(`Servidor rodando em http://${host}:${port}`);
    });
  } catch (error) {
    logger.error(`Falha ao iniciar servidor: ${error.message}`);
    process.exit(1);
  }
}

// Inicia servidor
startServer();