# Importações absolutas
import zmq
import json
import logging
import threading
import time
from datetime import datetime, timedelta

# Importar do mesmo diretório
from mt5_connector import MT5Connector
from extractor import MT5Extractor



# Configurar logger
logger = logging.getLogger("ZMQServer")

class MT5ZMQServer:
    """
    Servidor ZeroMQ para interface com backend Node.js.
    Implementa padrão de comunicação Request-Reply.
    """
    
    def __init__(self, port=5555, data_dir="./data"):
        self.port = port
        self.context = zmq.Context()
        self.socket = self.context.socket(zmq.REP)
        self.running = False
        self.thread = None
        
        # Componentes de integração MT5
        self.connector = MT5Connector()
        self.extractor = MT5Extractor(data_dir)
        
        # Controle de progresso
        self.active_extractions = {}
        
        logger.info(f"ZMQServer inicializado na porta {port}")
    
    def start(self):
        """Inicia o servidor ZeroMQ em uma thread separada"""
        if self.running:
            logger.warning("Servidor já está em execução")
            return
            
        try:
            endpoint = f"tcp://*:{self.port}"
            self.socket.bind(endpoint)
            logger.info(f"Servidor vinculado a {endpoint}")
            
            self.running = True
            self.thread = threading.Thread(target=self._run_server)
            self.thread.daemon = True
            self.thread.start()
            
            # Inicia thread de monitor de heartbeat
            self.heartbeat_thread = threading.Thread(target=self._run_heartbeat)
            self.heartbeat_thread.daemon = True
            self.heartbeat_thread.start()
            
            logger.info("Servidor ZeroMQ iniciado")
            return True
            
        except Exception as e:
            logger.exception(f"Erro ao iniciar servidor ZeroMQ: {str(e)}")
            return False
    
    def stop(self):
        """Para o servidor ZeroMQ"""
        if not self.running:
            return
            
        self.running = False
        
        try:
            self.socket.close()
            self.context.term()
            logger.info("Servidor ZeroMQ encerrado")
        except Exception as e:
            logger.exception(f"Erro ao encerrar servidor: {str(e)}")
    
    def _run_server(self):
        """Loop principal do servidor"""
        logger.info("Iniciando loop do servidor ZeroMQ")
        
        while self.running:
            try:
                # Aguarda mensagem com timeout para permitir finalização limpa
                if self.socket.poll(1000) == 0:
                    continue
                    
                # Recebe mensagem
                message = self.socket.recv_json()
                logger.info(f"Mensagem recebida: {message.get('action', 'unknown')}")
                
                # Processa mensagem
                response = self._process_message(message)
                
                # Envia resposta
                self.socket.send_json(response)
                
            except zmq.ZMQError as e:
                if self.running:  # Só loga erro se não for por causa do encerramento
                    logger.error(f"Erro ZMQ: {str(e)}")
                
            except Exception as e:
                logger.exception(f"Erro no processamento: {str(e)}")
                # Tenta enviar resposta de erro
                try:
                    self.socket.send_json({
                        "success": False,
                        "error": str(e)
                    })
                except:
                    pass
        
        logger.info("Loop do servidor ZeroMQ encerrado")
    
    def _run_heartbeat(self):
        """Thread de monitoramento do estado do MT5"""
        logger.info("Iniciando monitoramento de heartbeat")
        
        while self.running:
            try:
                # Verifica conexão MT5 a cada 5 segundos
                is_connected = self.connector.check_connection()
                
                # Se perdeu conexão, tenta reconectar
                if not is_connected and not self.connector.reconnect(max_attempts=1):
                    logger.warning("MT5 continua desconectado após tentativa")
                
            except Exception as e:
                logger.error(f"Erro no heartbeat: {str(e)}")
                
            # Aguarda próximo ciclo
            time.sleep(5)
    
    def _process_message(self, message):
        """Processa mensagem recebida do cliente"""
        action = message.get("action")
        
        handlers = {
            "connect": self._handle_connect,
            "disconnect": self._handle_disconnect,
            "status": self._handle_status,
            "extract": self._handle_extract,
            "extract_status": self._handle_extract_status,
            "cancel_extract": self._handle_cancel_extract
        }
        
        handler = handlers.get(action)
        
        if handler:
            return handler(message)
        else:
            return {
                "success": False,
                "error": f"Ação desconhecida: {action}"
            }
    
    def _handle_connect(self, message):
        """Manipula solicitação de conexão"""
        path = message.get("path")
        login = message.get("login")
        password = message.get("password")
        server = message.get("server")
        
        # Configura connector
        self.connector = MT5Connector(path, login, password, server)
        result = self.connector.connect()
        
        if result:
            return {
                "success": True,
                "status": self.connector.get_connection_status()
            }
        else:
            return {
                "success": False,
                "error": "Falha ao conectar ao MT5"
            }
    
    def _handle_disconnect(self, message):
        """Manipula solicitação de desconexão"""
        self.connector.disconnect()
        return {
            "success": True,
            "message": "MT5 desconectado"
        }
    
    def _handle_status(self, message):
        """Retorna status atual da conexão MT5"""
        return {
            "success": True,
            "status": self.connector.get_connection_status()
        }
    
    def _handle_extract(self, message):
        """Inicia extração de dados"""
        try:
            # Parâmetros da extração
            start_date_str = message.get("start_date")
            end_date_str = message.get("end_date")
            extract_id = message.get("extract_id") or f"extract_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Valida e converte datas
            try:
                start_date = datetime.fromisoformat(start_date_str)
                end_date = datetime.fromisoformat(end_date_str) if end_date_str else datetime.now()
            except (ValueError, TypeError) as e:
                return {
                    "success": False,
                    "error": f"Formato de data inválido: {str(e)}"
                }
            
            # Verifica se já existe extração ativa com este ID
            if extract_id in self.active_extractions:
                return {
                    "success": False,
                    "error": f"Extração com ID {extract_id} já está em andamento"
                }
            
            # Registra extração ativa
            self.active_extractions[extract_id] = {
                "id": extract_id,
                "start_time": datetime.now(),
                "progress": 0,
                "total": 0,
                "processed": 0,
                "status": "starting",
                "message": "Iniciando extração"
            }
            
            # Inicia extração em thread separada
            thread = threading.Thread(
                target=self._run_extraction,
                args=(extract_id, start_date, end_date)
            )
            thread.daemon = True
            thread.start()
            
            return {
                "success": True,
                "extract_id": extract_id,
                "message": "Extração iniciada"
            }
            
        except Exception as e:
            logger.exception(f"Erro ao iniciar extração: {str(e)}")
            return {
                "success": False,
                "error": f"Erro ao iniciar extração: {str(e)}"
            }
    
    def _handle_extract_status(self, message):
        """Retorna status atual de uma extração"""
        extract_id = message.get("extract_id")
        
        if not extract_id:
            return {
                "success": False,
                "error": "ID de extração não fornecido"
            }
            
        # Verifica se extração existe
        if extract_id in self.active_extractions:
            return {
                "success": True,
                "status": self.active_extractions[extract_id]
            }
        else:
            # Tenta verificar se foi concluída
            try:
                meta_file = self.extractor.raw_dir / f"{extract_id}_metadata.json"
                if meta_file.exists():
                    with open(meta_file, 'r') as f:
                        metadata = json.load(f)
                    
                    return {
                        "success": True,
                        "status": {
                            "id": extract_id,
                            "progress": 100,
                            "status": "completed",
                            "metadata": metadata
                        }
                    }
            except:
                pass
                
            # Verifica checkpoint
            checkpoint_data = self.extractor._load_checkpoint(extract_id)
            if checkpoint_data:
                return {
                    "success": True,
                    "status": {
                        "id": extract_id,
                        "progress": int(len(checkpoint_data["operations"]) / checkpoint_data["total_ops"] * 100),
                        "status": "paused",
                        "processed": len(checkpoint_data["operations"]),
                        "total": checkpoint_data["total_ops"],
                        "message": "Extração interrompida, pode ser retomada"
                    }
                }
            
            return {
                "success": False,
                "error": f"Extração {extract_id} não encontrada"
            }
    
    def _handle_cancel_extract(self, message):
        """Cancela uma extração em andamento"""
        extract_id = message.get("extract_id")
        
        if not extract_id:
            return {
                "success": False,
                "error": "ID de extração não fornecido"
            }
            
        # Verifica se extração está ativa
        if extract_id in self.active_extractions:
            self.active_extractions[extract_id]["status"] = "cancelled"
            
            # Aguarda um tempo para a thread detectar o cancelamento
            time.sleep(1)
            
            # Remove da lista de ativas
            if extract_id in self.active_extractions:
                del self.active_extractions[extract_id]
                
            return {
                "success": True,
                "message": f"Extração {extract_id} cancelada"
            }
        else:
            return {
                "success": False,
                "error": f"Extração {extract_id} não está ativa"
            }
    
    def _update_progress(self, extract_id, progress, total, processed, status_message):
        """Atualiza informações de progresso de uma extração"""
        if extract_id in self.active_extractions:
            self.active_extractions[extract_id].update({
                "progress": progress,
                "total": total,
                "processed": processed,
                "message": status_message,
                "last_update": datetime.now().isoformat()
            })
    
    def _run_extraction(self, extract_id, start_date, end_date):
        """Executa extração em thread separada"""
        try:
            logger.info(f"Iniciando thread de extração {extract_id}")
            
            # Atualiza status
            self.active_extractions[extract_id]["status"] = "extracting"
            
            # Função de callback para atualizar progresso
            def progress_callback(progress, total, processed, message):
                self._update_progress(extract_id, progress, total, processed, message)
                
                # Verifica se foi solicitado cancelamento
                cancelled = (extract_id in self.active_extractions and 
                           self.active_extractions[extract_id]["status"] == "cancelled")
                           
                return not cancelled  # Retorna False para interromper extração
            
            # Executa extração
            result = self.extractor.extract_history(
                start_date=start_date,
                end_date=end_date,
                extract_id=extract_id,
                callback=progress_callback
            )
            
            # Verifica se extração ainda está ativa (não foi cancelada)
            if extract_id in self.active_extractions:
                if result["success"]:
                    self.active_extractions[extract_id]["status"] = "completed"
                    self.active_extractions[extract_id]["progress"] = 100
                    self.active_extractions[extract_id]["message"] = "Extração concluída"
                    self.active_extractions[extract_id]["result"] = {
                        "total_operations": result["metadata"]["total_operations"]
                    }
                else:
                    self.active_extractions[extract_id]["status"] = "error"
                    self.active_extractions[extract_id]["message"] = f"Erro: {result.get('error', 'Desconhecido')}"
                
                # Mantém na lista por um tempo para cliente consultar
                time.sleep(60)
                
                # Remove da lista de extrações ativas
                if extract_id in self.active_extractions:
                    del self.active_extractions[extract_id]
            
        except Exception as e:
            logger.exception(f"Erro na thread de extração: {str(e)}")
            
            # Atualiza status com erro
            if extract_id in self.active_extractions:
                self.active_extractions[extract_id]["status"] = "error"
                self.active_extractions[extract_id]["message"] = f"Erro: {str(e)}"
                
# Adicionando ao MT5ZMQServer existente, na função _process_message

def _process_message(self, message):
    """Processa mensagem recebida do cliente"""
    action = message.get("action")
    
    handlers = {
        "connect": self._handle_connect,
        "disconnect": self._handle_disconnect,
        "status": self._handle_status,
        "extract": self._handle_extract,
        "extract_status": self._handle_extract_status,
        "cancel_extract": self._handle_cancel_extract,
        # Novos handlers
        "list_accounts": self._handle_list_accounts,
        "select_account": self._handle_select_account,
        "save_account_preference": self._handle_save_account_preference,
        "load_account_preference": self._handle_load_account_preference
    }
    
    handler = handlers.get(action)
    
    if handler:
        return handler(message)
    else:
        return {
            "success": False,
            "error": f"Ação desconhecida: {action}"
        }

# Adicione esses métodos à classe MT5ZMQServer

def _handle_list_accounts(self, message):
    """Manipula solicitação para listar contas disponíveis"""
    accounts = self.connector.list_available_accounts()
    
    return {
        "success": True,
        "accounts": accounts
    }

def _handle_select_account(self, message):
    """Manipula solicitação para selecionar uma conta"""
    login = message.get("login")
    password = message.get("password")
    server = message.get("server")
    
    if not login:
        return {
            "success": False,
            "error": "Login não fornecido"
        }
    
    result = self.connector.select_account(login, password, server)
    
    if result:
        return {
            "success": True,
            "message": f"Conta {login} selecionada com sucesso",
            "account_info": self.connector.get_connection_status().get("account_info")
        }
    else:
        return {
            "success": False,
            "error": f"Falha ao selecionar conta {login}"
        }

def _handle_save_account_preference(self, message):
    """Manipula solicitação para salvar preferência de conta"""
    login = message.get("login")
    server = message.get("server")
    path = message.get("config_path")
    
    if not login:
        return {
            "success": False,
            "error": "Login não fornecido"
        }
    
    result = self.connector.save_account_preference(login, server, path)
    
    return {
        "success": result,
        "message": "Preferência de conta salva" if result else "Falha ao salvar preferência"
    }

def _handle_load_account_preference(self, message):
    """Manipula solicitação para carregar preferência de conta"""
    path = message.get("config_path")
    
    preference = self.connector.load_account_preference(path)
    
    if preference:
        return {
            "success": True,
            "preference": preference
        }
    else:
        return {
            "success": False,
            "message": "Nenhuma preferência de conta encontrada"
        }

# Modificação na classe MT5ZMQServer em zmq_server.py

def __init__(self, port=5555, data_dir="./data", connector=None):
    self.port = port
    self.context = zmq.Context()
    self.socket = self.context.socket(zmq.REP)
    self.running = False
    self.thread = None
    
    # Componentes de integração MT5
    self.connector = connector or MT5Connector()  # Usa conector fornecido ou cria novo
    self.extractor = MT5Extractor(data_dir)
    
    # Controle de progresso
    self.active_extractions = {}
    
    logger.info(f"ZMQServer inicializado na porta {port}")