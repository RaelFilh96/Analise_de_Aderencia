# mt5_integration/utils.py

import os
import json
import logging
import hashlib
from datetime import datetime
from pathlib import Path

# Funções utilitárias compartilhadas

def create_directory_structure(base_dir):
    """Cria estrutura de diretórios necessária para a aplicação"""
    dirs = [
        "data/raw/extractions",
        "data/raw/backtests",
        "data/processed/adherence",
        "data/backups",
        "logs"
    ]
    
    for dir_path in dirs:
        path = Path(base_dir) / dir_path
        path.mkdir(parents=True, exist_ok=True)
        
    return True

def setup_logging(log_dir="./logs", level=logging.INFO):
    """Configura sistema de logging centralizado"""
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    
    log_file = log_dir / f"mt5_integration_{datetime.now().strftime('%Y%m%d')}.log"
    
    # Configuração do logger root
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    
    # Configurar níveis específicos
    logging.getLogger("MT5Connector").setLevel(level)
    logging.getLogger("MT5Extractor").setLevel(level)
    logging.getLogger("ZMQServer").setLevel(level)
    
    return log_file

def generate_extraction_id(start_date, end_date=None, prefix="extract"):
    """Gera ID único para extração baseado nas datas"""
    start_str = start_date.strftime('%Y%m%d')
    end_str = end_date.strftime('%Y%m%d') if end_date else datetime.now().strftime('%Y%m%d')
    timestamp = datetime.now().strftime('%H%M%S')
    
    return f"{prefix}_{start_str}_{end_str}_{timestamp}"

def backup_file(file_path, backup_dir="./data/backups"):
    """Cria backup de um arquivo antes de modificá-lo"""
    try:
        file_path = Path(file_path)
        backup_dir = Path(backup_dir)
        
        if not file_path.exists():
            return False
            
        # Cria diretório de backup por data
        date_dir = backup_dir / datetime.now().strftime('%Y%m%d')
        date_dir.mkdir(parents=True, exist_ok=True)
        
        # Nome do arquivo de backup
        timestamp = datetime.now().strftime('%H%M%S')
        backup_name = f"{file_path.stem}_{timestamp}{file_path.suffix}.bak"
        backup_path = date_dir / backup_name
        
        # Copia arquivo
        with open(file_path, 'rb') as src, open(backup_path, 'wb') as dst:
            dst.write(src.read())
            
        return str(backup_path)
        
    except Exception as e:
        logging.error(f"Erro ao fazer backup de {file_path}: {str(e)}")
        return False