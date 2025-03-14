# run_server.py atualizado com seleção interativa de conta

import argparse
import logging
import time
import os
from pathlib import Path
import getpass

# Importar do mesmo diretório
from zmq_server import MT5ZMQServer
from utils import create_directory_structure, setup_logging
from mt5_connector import MT5Connector

def select_account_interactive(connector):
    """Interface de linha de comando para seleção de conta MT5"""
    print("\n=== Seleção de Conta MetaTrader 5 ===\n")
    
    # Verifica se há preferência salva
    preference = connector.load_account_preference()
    if preference:
        print(f"Conta previamente utilizada: {preference.get('login')} (Servidor: {preference.get('server')})")
        use_saved = input("Usar esta conta? (S/n): ").strip().lower()
        if use_saved != 'n':
            return connector.select_account(preference.get('login'), server=preference.get('server'))
    
    # Lista contas disponíveis
    accounts = connector.list_available_accounts()
    
    if not accounts:
        print("Nenhuma conta MT5 disponível. Verifique se o MetaTrader 5 está aberto e logado.")
        return False
    
    print("\nContas disponíveis:")
    for i, acc in enumerate(accounts):
        print(f"  [{i+1}] {acc['login']} - {acc.get('name', 'N/A')} (Servidor: {acc['server']})")
    
    # Seleção da conta
    while True:
        try:
            choice = input("\nSelecione o número da conta (ou 'q' para sair): ").strip()
            
            if choice.lower() == 'q':
                print("Operação cancelada.")
                return False
            
            idx = int(choice) - 1
            if 0 <= idx < len(accounts):
                selected = accounts[idx]
                break
            else:
                print(f"Opção inválida. Escolha entre 1 e {len(accounts)}.")
        except ValueError:
            print("Por favor, digite um número válido.")
    
    # Verifica se precisa de senha
    need_password = input("A conta requer senha para login? (s/N): ").strip().lower() == 's'
    password = None
    
    if need_password:
        password = getpass.getpass("Digite a senha (não será exibida): ")
    
    # Tenta conectar
    print(f"\nConectando à conta {selected['login']}...")
    result = connector.select_account(selected['login'], password, selected['server'])
    
    if result:
        print(f"Conectado com sucesso à conta {selected['login']}!")
        save_pref = input("Salvar esta conta como preferência para uso futuro? (S/n): ").strip().lower()
        if save_pref != 'n':
            connector.save_account_preference(selected['login'], selected['server'])
            print("Preferência salva.")
    else:
        print(f"Falha ao conectar à conta {selected['login']}.")
    
    return result

def run_server(port=5555, data_dir="./data", log_level="INFO", account_mode="interactive"):
    """
    Inicializa e executa o servidor ZeroMQ para integração MT5.
    
    Args:
        port (int): Porta para o servidor ZeroMQ
        data_dir (str): Diretório para armazenamento de dados
        log_level (str): Nível de logging
        account_mode (str): Modo de seleção de conta:
            - "interactive": Selecionar conta interativamente
            - "auto": Usar preferência salva ou primeira disponível
            - "none": Não selecionar conta (usar a atual)
    """
    # Converter para caminho absoluto
    data_dir = Path(data_dir).resolve()
    
    # Setup inicial
    create_directory_structure(data_dir)
    log_level_enum = getattr(logging, log_level.upper(), logging.INFO)
    
    # Inicializa o conector MT5 para seleção de conta
    connector = MT5Connector()
    connector.connect()  # Conecta sem conta específica inicialmente
    
    # Seleção de conta baseada no modo especificado
    if account_mode == "interactive":
        if not select_account_interactive(connector):
            print("Abortando inicialização do servidor devido a falha na seleção de conta.")
            return
    elif account_mode == "auto":
        # Tenta usar preferência salva
        preference = connector.load_account_preference()
        if preference:
            login = preference.get('login')
            server = preference.get('server')
            print(f"Tentando usar conta preferida: {login}")
            if not connector.select_account(login, server=server):
                print(f"Falha ao usar conta preferida. Usando primeira disponível.")
    # No modo "none", mantém a conexão atual sem alteração
    
    # Configura logging completo após seleção de conta
    log_file = setup_logging(f"{data_dir}/logs", log_level_enum)
    
    logger = logging.getLogger("MT5Integration")
    logger.info(f"Iniciando servidor ZeroMQ na porta {port}")
    logger.info(f"Logs serão salvos em {log_file}")
    logger.info(f"Diretório de dados: {data_dir}")
    
    # Cria e inicia servidor usando o conector já inicializado
    server = MT5ZMQServer(port=port, data_dir=str(data_dir), connector=connector)
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
    parser.add_argument("--account", type=str, choices=["interactive", "auto", "none"], 
                        default="interactive", help="Modo de seleção de conta")
    
    args = parser.parse_args()
    run_server(args.port, args.data, args.log_level, args.account)