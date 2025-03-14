# account_manager.py - Funções para gerenciar preferências de conta

import json
from pathlib import Path
from datetime import datetime

def save_account_preference(login, server=None, path=None):
    """Salva preferência de conta para uso futuro"""
    try:
        # Determina o diretório de configuração
        if path:
            config_dir = Path(path)
        else:
            config_dir = Path.home() / ".mt5adherence"
            
        config_dir.mkdir(parents=True, exist_ok=True)
        
        # Arquivo de configuração
        config_file = config_dir / "account_preference.json"
        
        # Prepara dados para salvar
        preference = {
            "login": login,
            "server": server,
            "last_used": datetime.now().isoformat()
        }
        
        # Salva no arquivo
        with open(config_file, 'w') as f:
            json.dump(preference, f, indent=2)
            
        print(f"Preferência de conta salva: {login}")
        return True
        
    except Exception as e:
        print(f"Não foi possível salvar preferência de conta: {str(e)}")
        return False

def load_account_preference(path=None):
    """Carrega preferência de conta salva"""
    try:
        # Determina o diretório de configuração
        if path:
            config_dir = Path(path)
        else:
            config_dir = Path.home() / ".mt5adherence"
            
        config_file = config_dir / "account_preference.json"
        
        if not config_file.exists():
            print("Nenhuma preferência de conta encontrada")
            return None
            
        # Carrega do arquivo
        with open(config_file, 'r') as f:
            preference = json.load(f)
            
        print(f"Preferência de conta carregada: {preference.get('login')}")
        return preference
        
    except Exception as e:
        print(f"Não foi possível carregar preferência de conta: {str(e)}")
        return None