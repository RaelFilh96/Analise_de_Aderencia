# Importações absolutas em vez de relativas
import MetaTrader5 as mt5
import logging
import time
from datetime import datetime, timedelta

# Configurar logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("mt5_connector.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("MT5Connector")

class MT5Connector:
    """
    Classe responsável pela conexão com o MetaTrader 5 e operações básicas.
    Implementa padrão Singleton para garantir apenas uma instância ativa.
    """
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(MT5Connector, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, path=None, login=None, password=None, server=None):
        # Evita reinicialização se já inicializado
        if self._initialized:
            return
            
        self.path = path
        self.login = login
        self.password = password
        self.server = server
        self.connected = False
        self.last_heartbeat = None
        self._initialized = True
        logger.info("MT5Connector instanciado. Aguardando conexão.")
    
    def connect(self):
        """Estabelece conexão com o terminal MT5"""
        try:
            # Tenta inicializar o MT5 com os parâmetros fornecidos
            init_params = {}
            if self.path:
                init_params["path"] = self.path
            if self.login:
                init_params["login"] = self.login
                init_params["password"] = self.password
                init_params["server"] = self.server
                
            # Inicializa o MT5
            initialized = mt5.initialize(**init_params)
            
            if not initialized:
                error = mt5.last_error()
                logger.error(f"Falha ao inicializar MT5: {error}")
                self.connected = False
                return False
                
            logger.info("MT5 inicializado com sucesso")
            
            # Verifica se a conexão está realmente estabelecida
            if not mt5.terminal_info():
                logger.error("MT5 inicializado mas terminal_info falhou")
                self.connected = False
                return False
                
            # Atualiza estado e heartbeat
            self.connected = True
            self.last_heartbeat = datetime.now()
            
            # Obtém informações básicas do terminal
            terminal_info = mt5.terminal_info()
            account_info = mt5.account_info()
            
            logger.info(f"Conectado ao MT5 (build {terminal_info.build})")
            if account_info:
                logger.info(f"Conta: {account_info.login}, Servidor: {account_info.server}")
                
            return True
            
        except Exception as e:
            logger.exception(f"Erro ao conectar ao MT5: {str(e)}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Desconecta do terminal MT5"""
        if not self.connected:
            return
            
        try:
            mt5.shutdown()
            self.connected = False
            logger.info("MT5 desconectado com sucesso")
            
        except Exception as e:
            logger.exception(f"Erro ao desconectar do MT5: {str(e)}")
    
    def check_connection(self):
        """Verifica se a conexão com MT5 está ativa"""
        try:
            if not self.connected:
                return False
                
            # Tenta obter informações do terminal como teste de conexão
            terminal_info = mt5.terminal_info()
            if terminal_info:
                self.last_heartbeat = datetime.now()
                return True
                
            logger.warning("Conexão com MT5 perdida")
            self.connected = False
            return False
            
        except Exception as e:
            logger.warning(f"Erro ao verificar conexão MT5: {str(e)}")
            self.connected = False
            return False
    
    def get_connection_status(self):
        """Retorna informações detalhadas sobre o estado da conexão"""
        status = {
            "connected": self.connected,
            "last_heartbeat": self.last_heartbeat,
            "terminal_info": None,
            "account_info": None,
            "version": None
        }
        
        if self.connected:
            try:
                status["terminal_info"] = mt5.terminal_info()._asdict()
                status["account_info"] = mt5.account_info()._asdict() if mt5.account_info() else None
                status["version"] = status["terminal_info"].get("build") if status["terminal_info"] else None
            except:
                # Se ocorrer erro ao obter informações, provavelmente a conexão foi perdida
                self.connected = False
                status["connected"] = False
                
        return status
    
    def reconnect(self, max_attempts=3, delay=5):
        """Tenta reconectar ao MT5 após falha"""
        if self.connected:
            return True
            
        logger.info(f"Tentando reconectar ao MT5 (max {max_attempts} tentativas)")
        
        for attempt in range(1, max_attempts + 1):
            logger.info(f"Tentativa de reconexão {attempt}/{max_attempts}")
            
            if self.connect():
                logger.info("Reconexão bem-sucedida")
                return True
                
            # Aguarda antes da próxima tentativa (exceto na última)
            if attempt < max_attempts:
                time.sleep(delay)
                
        logger.error(f"Falha em reconectar após {max_attempts} tentativas")
        return False 
# Adicionando ao MT5Connector existente

def list_available_accounts(self):
    """Lista todas as contas MT5 disponíveis no terminal"""
    try:
        # Tenta inicializar o MT5 se ainda não estiver conectado
        if not self.connected and not mt5.initialize():
            error = mt5.last_error()
            logger.error(f"Falha ao inicializar MT5 para listar contas: {error}")
            return []
        
        # Obter informações de contas
        accounts = mt5.account_info()
        if accounts is None:
            logger.warning("Não foi possível obter informações de contas")
            return []
            
        # Se account_info retornou uma única conta (objeto Terminal)
        if not isinstance(accounts, list):
            current_account = accounts._asdict()
            # Tentar obter outras contas disponíveis
            terminal_info = mt5.terminal_info()
            return [{
                'login': current_account.get('login'),
                'server': current_account.get('server'),
                'name': current_account.get('name', ''),
                'currency': current_account.get('currency', ''),
                'current': True
            }]
        
        # Formata as informações de cada conta
        account_list = []
        for acc in accounts:
            acc_dict = acc._asdict()
            account_list.append({
                'login': acc_dict.get('login'),
                'server': acc_dict.get('server'),
                'name': acc_dict.get('name', ''),
                'currency': acc_dict.get('currency', ''),
                'current': False  # Será atualizado abaixo
            })
        
        # Verifica a conta atual
        current = mt5.account_info()
        if current:
            current_login = current.login
            for acc in account_list:
                if acc['login'] == current_login:
                    acc['current'] = True
        
        return account_list
        
    except Exception as e:
        logger.exception(f"Erro ao listar contas MT5: {str(e)}")
        return []

def select_account(self, login, password=None, server=None):
    """Seleciona uma conta específica para login"""
    try:
        # Inicializa MT5 se necessário
        if not mt5.initialize():
            error = mt5.last_error()
            logger.error(f"Falha ao inicializar MT5 para seleção de conta: {error}")
            return False
        
        # Verifica se já está logado na conta solicitada
        current = mt5.account_info()
        if current and current.login == login:
            logger.info(f"Já conectado à conta {login}")
            self.connected = True
            self.login = login
            self.server = current.server
            self.last_heartbeat = datetime.now()
            return True
        
        # Tenta autenticar na conta selecionada
        logger.info(f"Tentando conectar à conta {login}")
        
        # Se senha não foi fornecida, tentará mudar sem senha (pode funcionar se já autenticado no terminal)
        if password:
            auth_result = mt5.login(login, password=password, server=server)
        else:
            auth_result = mt5.login(login)
            
        if not auth_result:
            error = mt5.last_error()
            logger.error(f"Falha ao autenticar na conta {login}: {error}")
            return False
        
        # Verificando se o login foi bem-sucedido
        account_info = mt5.account_info()
        if not account_info or account_info.login != login:
            logger.error(f"Autenticação reportou sucesso, mas conta não foi alterada para {login}")
            return False
        
        # Atualiza informações da conta selecionada
        self.connected = True
        self.login = login
        self.server = account_info.server
        self.password = password  # Armazena senha para reconexões
        self.last_heartbeat = datetime.now()
        
        logger.info(f"Conectado com sucesso à conta {login} no servidor {account_info.server}")
        return True
        
    except Exception as e:
        logger.exception(f"Erro ao selecionar conta {login}: {str(e)}")
        return False

def save_account_preference(self, login, server=None, path=None):
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
            
        logger.info(f"Preferência de conta salva: {login}")
        return True
        
    except Exception as e:
        logger.warning(f"Não foi possível salvar preferência de conta: {str(e)}")
        return False

def load_account_preference(self, path=None):
    """Carrega preferência de conta salva"""
    try:
        # Determina o diretório de configuração
        if path:
            config_dir = Path(path)
        else:
            config_dir = Path.home() / ".mt5adherence"
            
        config_file = config_dir / "account_preference.json"
        
        if not config_file.exists():
            logger.info("Nenhuma preferência de conta encontrada")
            return None
            
        # Carrega do arquivo
        with open(config_file, 'r') as f:
            preference = json.load(f)
            
        logger.info(f"Preferência de conta carregada: {preference.get('login')}")
        return preference
        
    except Exception as e:
        logger.warning(f"Não foi possível carregar preferência de conta: {str(e)}")
        return None
# Atualização do método connect no MT5Connector

def connect(self):
    """Estabelece conexão com o terminal MT5"""
    try:
        # Tenta inicializar o MT5 com os parâmetros fornecidos
        init_params = {}
        if self.path:
            init_params["path"] = self.path
            
        # Inicializa o MT5 sem tentar login específico primeiro
        initialized = mt5.initialize(**init_params)
        
        if not initialized:
            error = mt5.last_error()
            logger.error(f"Falha ao inicializar MT5: {error}")
            self.connected = False
            return False
            
        logger.info("MT5 inicializado com sucesso")
        
        # Se temos credenciais específicas, tenta login
        if self.login and self.password:
            login_result = mt5.login(self.login, password=self.password, server=self.server)
            if not login_result:
                error = mt5.last_error()
                logger.warning(f"MT5 inicializado mas login na conta {self.login} falhou: {error}")
                # Continua mesmo com falha no login, para permitir seleção manual
        
        # Verifica se a conexão está realmente estabelecida
        if not mt5.terminal_info():
            logger.error("MT5 inicializado mas terminal_info falhou")
            self.connected = False
            return False
            
        # Atualiza estado e heartbeat
        self.connected = True
        self.last_heartbeat = datetime.now()
        
        # Obtém informações básicas do terminal
        terminal_info = mt5.terminal_info()
        account_info = mt5.account_info()
        
        logger.info(f"Conectado ao MT5 (build {terminal_info.build})")
        if account_info:
            logger.info(f"Conta: {account_info.login}, Servidor: {account_info.server}")
            # Atualiza informações da conta atual
            self.login = account_info.login
            self.server = account_info.server
            
        return True
        
    except Exception as e:
        logger.exception(f"Erro ao conectar ao MT5: {str(e)}")
        self.connected = False
        return False