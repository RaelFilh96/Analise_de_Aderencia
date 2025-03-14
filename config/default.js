// src/backend/config/default.js

module.exports = {
    server: {
      port: process.env.PORT || 3000,
      host: process.env.HOST || 'localhost'
    },
    zmq: {
      endpoint: 'tcp://localhost:5555',
      requestTimeout: 30000, // 30 segundos
      reconnectInterval: 5000 // 5 segundos
    },
    storage: {
      dataDir: '../data',
      backupBeforeWrite: true,
      csvOptions: {
        delimiter: ',',
        header: true,
        encoding: 'utf8'
      }
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      file: '../data/logs/backend.log'
    }
  };