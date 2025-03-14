# mt5adherence/mt5_integration/__init__.py

# Usando importações absolutas
from mt5adherence.mt5_integration.mt5_connector import MT5Connector
from mt5adherence.mt5_integration.extractor import MT5Extractor
from mt5adherence.mt5_integration.zmq_server import MT5ZMQServer
from mt5adherence.mt5_integration.utils import create_directory_structure, setup_logging

import argparse
import logging
import time

def run_server(port=5555, data_dir="./data", log_level="INFO"):
    """
    Inicializa e executa o servidor ZeroMQ para integração MT5.
    Esta função pode ser executada diretamente para iniciar o serviço.
    """
    # Configurar níveis de log
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Setup inicial
    create_directory_structure(data_dir)
    log_file = setup_logging(f"{data_dir}/logs", level)
    
    logger = logging.getLogger("MT5Integration")
    logger.info(f"Iniciando servidor ZeroMQ na porta {port}")
    logger.info(f"Logs serão salvos em {log_file}")
    
    # Cria e inicia servidor
    server = MT5ZMQServer(port=port, data_dir=data_dir)
    success = server.start()
    
    if not success:
        logger.error("Falha ao iniciar servidor")
        return
    
    # Mantém servidor rodando
    try:
        logger.info("Servidor em execução. Pressione Ctrl+C para encerrar.")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Encerrando servidor...")
        server.stop()
        logger.info("Servidor encerrado")