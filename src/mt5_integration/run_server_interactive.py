# run_server_interactive.py - Versão simplificada com seleção de conta

import argparse
import logging
import time
import os
from pathlib import Path
import MetaTrader5 as mt5

# Importações do seu projeto
from zmq_server import MT5ZMQServer
from utils import create_directory_structure, setup_logging
from mt5_connector import MT5Connector

def list_mt5_accounts():
    """Lista contas disponíveis no terminal MT5"""
    # Inicializa MT5 se necessário
    if not mt5.initialize():
        print(f"Erro ao inicializar MT5: {mt5.last_error()}")
        return []
    
    # Obter a conta atual (única informação disponível diretamente via API)
    current = mt5.account_info()
    if not current:
        print("Não foi possível obter informações da conta atual")
        return []
    
    # Converter para dicionário
    current_dict = current._asdict()
    
    # Para fins de demonstração, retornamos apenas a conta atual
    # Em uma implementação real, você poderia usar APIs adicionais ou UI automation
    # para listar todas as contas disponíveis
    return [{
        'login': current_dict.get('login'),
        'server': current_dict.get('server'),
        'name': current_dict.get('name', ''),
        'company': current_dict.get('company', ''),
        'current': True
    }]

def select_account_interactive():
    """Interface de linha de comando para seleção de conta MT5"""
    print("\n=== Seleção de Conta MetaTrader 5 ===\n")
    
    # Lista contas (atualmente apenas a conta ativa)
    accounts = list_mt5_accounts()
    
    if not accounts:
        print("Nenhuma conta MT5 disponível. Verifique se o MetaTrader 5 está aberto e logado.")
        return False
    
    print("Contas disponíveis:")
    for i, acc in enumerate(accounts):
        status = "(atual)" if acc.get('current', False) else ""
        print(f"  [{i+1}] {acc['login']} - {acc.get('company', 'N/A')} (Servidor: {acc['server']}) {status}")
    
    # Para esta versão simplificada, apenas mostramos a conta atual
    # e prosseguimos com ela
    print("\nUsando a conta atual do MetaTrader 5")
    return True

def run_server(port=5555, data_dir="./data", log_level="INFO"):
    """
    Inicializa e executa o servidor ZeroMQ para integração MT5.
    """
    # Converter para caminho absoluto
    data_dir = Path(data_dir).resolve()
    
    # Seleção interativa de conta (simplificada)
    if not select_account_interactive():
        print("Abortando inicialização do servidor.")
        return
    
    # Setup inicial
    create_directory_structure(data_dir)
    log_file = setup_logging(f"{data_dir}/logs", getattr(logging, log_level.upper(), logging.INFO))
    
    logger = logging.getLogger("MT5Integration")
    logger.info(f"Iniciando servidor ZeroMQ na porta {port}")
    logger.info(f"Logs serão salvos em {log_file}")
    logger.info(f"Diretório de dados: {data_dir}")
    
    # Cria e inicia servidor
    server = MT5ZMQServer(port=port, data_dir=str(data_dir))
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

if __name__ == "__main__":
    # Quando executado diretamente, configura através de argumentos CLI
    parser = argparse.ArgumentParser(description="Servidor de Integração MT5")
    parser.add_argument("--port", type=int, default=5555, help="Porta para servidor ZeroMQ")
    parser.add_argument("--data", type=str, default="./data", help="Diretório para dados")
    parser.add_argument("--log-level", type=str, default="INFO", help="Nível de log (DEBUG, INFO, WARNING, ERROR)")
    
    args = parser.parse_args()
    run_server(args.port, args.data, args.log_level)