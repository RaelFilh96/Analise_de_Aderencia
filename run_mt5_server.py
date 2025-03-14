# run_mt5_server.py
import argparse
from mt5adherence.mt5_integration import run_server

if __name__ == "__main__":
    # Quando executado diretamente, configura através de argumentos CLI
    parser = argparse.ArgumentParser(description="Servidor de Integração MT5")
    parser.add_argument("--port", type=int, default=5555, help="Porta para servidor ZeroMQ")
    parser.add_argument("--data", type=str, default="./data", help="Diretório para dados")
    parser.add_argument("--log-level", type=str, default="INFO", help="Nível de log (DEBUG, INFO, WARNING, ERROR)")
    
    args = parser.parse_args()
    run_server(args.port, args.data, args.log_level)