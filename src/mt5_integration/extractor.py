# Importações absolutas
import MetaTrader5 as mt5
import pandas as pd
import logging
import os
import time
import json
from datetime import datetime, timedelta
from pathlib import Path

# Importar do mesmo diretório
from mt5_connector import MT5Connector

# Configurar logger
logger = logging.getLogger("MT5Extractor")

class MT5Extractor:
    """
    Classe responsável pela extração de dados históricos do MT5
    com suporte a checkpoints e recuperação de falhas.
    """
    
    def __init__(self, data_dir="./data"):
        self.connector = MT5Connector()
        self.data_dir = Path(data_dir)
        self.raw_dir = self.data_dir / "raw" / "extractions"
        self.checkpoint_dir = self.data_dir / "checkpoints"
        
        # Cria diretórios se não existirem
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"MT5Extractor inicializado (diretório: {self.data_dir})")
    
    def extract_history(self, start_date, end_date=None, checkpoint_size=500, 
                       callback=None, extract_id=None):
        """
        Extrai histórico de operações do MT5 com suporte a checkpoints.
        
        Args:
            start_date (datetime): Data inicial para extração
            end_date (datetime, optional): Data final (padrão: data atual)
            checkpoint_size (int): Número de operações por checkpoint
            callback (callable): Função para reportar progresso
            extract_id (str): ID da extração (para recuperação)
            
        Returns:
            dict: Resultado da extração com metadados
        """
        # Valida conexão MT5
        if not self.connector.connected and not self.connector.connect():
            logger.error("Não foi possível conectar ao MT5 para extração")
            return {
                "success": False,
                "error": "Falha de conexão com MT5",
                "operations": None,
                "metadata": None
            }
            
        # Inicializa parâmetros
        end_date = end_date or datetime.now()
        extract_id = extract_id or f"extract_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Verifica checkpoint existente
        checkpoint_data = self._load_checkpoint(extract_id)
        
        # Se existe checkpoint, continua a partir dele
        if checkpoint_data:
            logger.info(f"Continuando extração {extract_id} a partir do checkpoint")
            operations = checkpoint_data["operations"]
            last_date = checkpoint_data["last_date"]
            start_date = datetime.fromisoformat(last_date)
            total_ops = checkpoint_data["total_ops"]
            processed_ops = len(operations)
        else:
            logger.info(f"Iniciando nova extração {extract_id}")
            operations = []
            total_ops = self._estimate_operations_count(start_date, end_date)
            processed_ops = 0
            
        # Reporta progresso inicial
        if callback:
            callback(0, total_ops, processed_ops, "Iniciando extração")
        
        try:
            # Loop de extração principal
            current_date = start_date
            batch_size = timedelta(days=7)  # Extrai em lotes de 7 dias
            
            while current_date <= end_date:
                # Define janela de extração
                batch_end = min(current_date + batch_size, end_date)
                
                logger.info(f"Extraindo operações de {current_date} até {batch_end}")
                
                # Extrai ordens fechadas no período
                orders = mt5.history_deals_get(current_date, batch_end)
                
                if orders is None:
                    error = mt5.last_error()
                    logger.warning(f"Sem ordens no período ou erro: {error}")
                    current_date = batch_end
                    continue
                    
                # Converte para DataFrame para facilitar manipulação
                if len(orders) > 0:
                    orders_df = pd.DataFrame(list(orders), columns=orders[0]._asdict().keys())
                    orders_list = orders_df.to_dict('records')
                    operations.extend(orders_list)
                    
                    processed_ops += len(orders_list)
                    
                    # Reporta progresso
                    if callback:
                        progress = min(int(processed_ops / total_ops * 100), 99)
                        callback(progress, total_ops, processed_ops, "Extraindo operações")
                    
                    # Salva checkpoint a cada checkpoint_size operações
                    if len(operations) % checkpoint_size == 0:
                        self._save_checkpoint(extract_id, operations, batch_end.isoformat(), total_ops)
                        logger.info(f"Checkpoint salvo: {len(operations)} operações")
                
                # Avança para o próximo lote
                current_date = batch_end
            
            # Finaliza extração
            result = {
                "success": True,
                "operations": operations,
                "metadata": {
                    "extract_id": extract_id,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "total_operations": len(operations),
                    "timestamp": datetime.now().isoformat()
                }
            }
            
            # Salva resultado final
            self._save_extraction(extract_id, result)
            
            # Limpa checkpoint (extração completa)
            self._clear_checkpoint(extract_id)
            
            # Reporta conclusão
            if callback:
                callback(100, total_ops, processed_ops, "Extração concluída")
                
            logger.info(f"Extração {extract_id} concluída: {len(operations)} operações")
            return result
            
        except Exception as e:
            logger.exception(f"Erro durante extração: {str(e)}")
            
            # Salva checkpoint do progresso atual para possível recuperação
            if operations:
                self._save_checkpoint(extract_id, operations, current_date.isoformat(), total_ops)
                
            return {
                "success": False,
                "error": str(e),
                "operations": operations,
                "metadata": {
                    "extract_id": extract_id,
                    "partial": True,
                    "start_date": start_date.isoformat(),
                    "error_date": current_date.isoformat(),
                    "total_operations": len(operations),
                    "timestamp": datetime.now().isoformat()
                }
            }
    
    def _estimate_operations_count(self, start_date, end_date):
        """Estima quantidade de operações para cálculo de progresso"""
        try:
            # Amostra para estimar total
            sample_start = max(start_date, end_date - timedelta(days=7))
            orders = mt5.history_deals_get(sample_start, end_date)
            
            if orders is None or len(orders) == 0:
                return 1000  # Valor padrão se não conseguir estimar
                
            # Calcula média diária e extrapola para período completo
            days_in_sample = (end_date - sample_start).days or 1
            days_total = (end_date - start_date).days or 1
            daily_avg = len(orders) / days_in_sample
            
            estimated = max(int(daily_avg * days_total), 1)
            logger.info(f"Operações estimadas: {estimated}")
            return estimated
            
        except Exception as e:
            logger.warning(f"Erro ao estimar operações: {str(e)}")
            return 1000  # Valor padrão em caso de erro
    
    def _save_checkpoint(self, extract_id, operations, last_date, total_ops):
        """Salva checkpoint para possível recuperação"""
        checkpoint_file = self.checkpoint_dir / f"{extract_id}.checkpoint.json"
        
        checkpoint_data = {
            "extract_id": extract_id,
            "operations": operations,
            "last_date": last_date,
            "total_ops": total_ops,
            "timestamp": datetime.now().isoformat()
        }
        
        with open(checkpoint_file, 'w') as f:
            json.dump(checkpoint_data, f)
    
    def _load_checkpoint(self, extract_id):
        """Carrega checkpoint existente"""
        checkpoint_file = self.checkpoint_dir / f"{extract_id}.checkpoint.json"
        
        if not checkpoint_file.exists():
            return None
            
        try:
            with open(checkpoint_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Erro ao carregar checkpoint: {str(e)}")
            return None
    
    def _clear_checkpoint(self, extract_id):
        """Remove arquivo de checkpoint após conclusão"""
        checkpoint_file = self.checkpoint_dir / f"{extract_id}.checkpoint.json"
        
        if checkpoint_file.exists():
            checkpoint_file.unlink()
    
    def _save_extraction(self, extract_id, result):
        """Salva resultado da extração em CSV e JSON"""
        # Salva metadados
        meta_file = self.raw_dir / f"{extract_id}_metadata.json"
        with open(meta_file, 'w') as f:
            json.dump(result["metadata"], f, indent=2)
        
        # Salva operações em CSV
        if result["operations"]:
            ops_df = pd.DataFrame(result["operations"])
            csv_file = self.raw_dir / f"{extract_id}_operations.csv"
            ops_df.to_csv(csv_file, index=False)
            
        logger.info(f"Extração salva: {meta_file}")
        
    def categorize_by_ea(self, operations):
        """
        Categoriza operações por EA com base no campo comment
        
        Returns:
            dict: Operações agrupadas por EA ID
        """
        categorized = {}
        
        for op in operations:
            # Extrai ID do EA do comentário (assumindo formato padrão EA_[NOME]_[ID])
            ea_id = "unknown"
            comment = op.get("comment", "")
            
            # Tenta extrair ID do EA do comentário
            if "EA_" in comment:
                parts = comment.split("_")
                if len(parts) >= 3:
                    ea_id = parts[2]
            
            # Agrupa por EA ID
            if ea_id not in categorized:
                categorized[ea_id] = []
            
            categorized[ea_id].append(op)
        
        return categorized