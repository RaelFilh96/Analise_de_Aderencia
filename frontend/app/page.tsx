'use client';

import { useState, useEffect } from 'react';
import { eaService, extractionService, backtestService, mt5Service } from '../lib/api';

export default function Page() {
    // Estados para UI
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBacktestModalOpen, setIsBacktestModalOpen] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionProgress, setExtractionProgress] = useState(0);
    const [selectedEA, setSelectedEA] = useState(null);
    const [periodOption, setPeriodOption] = useState('7dias');
    const [filterPeriod, setFilterPeriod] = useState('Semana');
    const [lastExtraction, setLastExtraction] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedEAForBacktest, setSelectedEAForBacktest] = useState(null);
    
    // Estados para dados e API
    const [eas, setEas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mt5Connected, setMt5Connected] = useState(false);
    const [activeExtraction, setActiveExtraction] = useState(null);
    const [systemSummary, setSystemSummary] = useState({
        totalEAs: 0,
        avgAdherence: 0,
        totalOperations: 0,
        avgSlippage: '0.0'
    });

    // Carregar EAs da API
    useEffect(() => {
        async function loadEAs() {
            try {
                setLoading(true);
                const data = await eaService.listEAs();
                setEas(data);
                
                // Atualizar resumo do sistema
                setSystemSummary({
                    totalEAs: data.length,
                    avgAdherence: Math.round(data.reduce((sum, ea) => sum + ea.metrics.adherenceRate, 0) / data.length),
                    totalOperations: data.reduce((sum, ea) => sum + (ea.metrics.operations || 0), 0),
                    avgSlippage: (data.reduce((sum, ea) => sum + (ea.metrics.slippage || 0), 0) / data.length).toFixed(2)
                });
                
                setLoading(false);
            } catch (err) {
                setError('Erro ao carregar dados dos EAs');
                setLoading(false);
                console.error(err);
            }
        }
        
        loadEAs();
    }, []);
    
    // Verificar status do MT5
    useEffect(() => {
        async function checkMT5Status() {
            try {
                const status = await mt5Service.getStatus();
                setMt5Connected(status.connected);
            } catch (err) {
                setMt5Connected(false);
                console.error("Erro ao verificar status do MT5:", err);
            }
        }
        
        checkMT5Status();
        // Verificar status a cada 30 segundos
        const interval = setInterval(checkMT5Status, 30000);
        return () => clearInterval(interval);
    }, []);
    
    // Verificar extrações ativas
    useEffect(() => {
        async function checkActiveExtractions() {
            try {
                const extractions = await extractionService.listActiveExtractions();
                if (extractions && extractions.length > 0) {
                    const current = extractions[0];
                    setActiveExtraction(current);
                    setIsExtracting(true);
                    setExtractionProgress(current.progress || 0);
                    
                    // Se extração completa, atualizar última extração
                    if (current.status === 'completed') {
                        setLastExtraction(new Date(current.timestamp).toLocaleString());
                        setIsExtracting(false);
                    }
                }
            } catch (err) {
                console.error("Erro ao verificar extrações ativas:", err);
            }
        }
        
        checkActiveExtractions();
        // Verificar extrações a cada 5 segundos durante extração ativa
        const interval = setInterval(() => {
            if (isExtracting || activeExtraction) {
                checkActiveExtractions();
            }
        }, 5000);
        
        return () => clearInterval(interval);
    }, [isExtracting, activeExtraction]);
    
    // Iniciar extração
    const startExtraction = async () => {
        try {
            setIsModalOpen(false);
            
            let startDate, endDate;
            const today = new Date();
            
            // Converter período selecionado para datas
            switch (periodOption) {
                case '7dias':
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 7);
                    break;
                case '15dias':
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 15);
                    break;
                case '30dias':
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 30);
                    break;
                case 'Personalizado':
                    // Usar datas do formulário
                    // Este caso precisaria de campos de data adicionais na UI
                    break;
                default:
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 7);
            }
            
            endDate = today;
            
            // Iniciar extração via API
            setIsExtracting(true);
            setExtractionProgress(0);
            
            const result = await extractionService.startExtraction({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });
            
            // Monitorar progresso
            if (result && result.extractId) {
                setActiveExtraction(result.extractId);
                
                // Iniciar polling de status
                const statusInterval = setInterval(async () => {
                    try {
                        const status = await extractionService.getExtractionStatus(result.extractId);
                        
                        if (status && status.status) {
                            setExtractionProgress(status.status.progress || 0);
                            
                            // Se concluído ou com erro, parar polling
                            if (status.status.status === 'completed' || status.status.status === 'error') {
                                clearInterval(statusInterval);
                                setIsExtracting(false);
                                setLastExtraction(new Date().toLocaleString());
                                
                                // Recarregar EAs após extração concluída
                                const updatedEAs = await eaService.listEAs();
                                setEas(updatedEAs);
                            }
                        }
                    } catch (err) {
                        console.error("Erro ao verificar status da extração:", err);
                    }
                }, 2000);
            }
        } catch (error) {
            console.error("Erro ao iniciar extração:", error);
            setIsExtracting(false);
            setError("Falha ao iniciar extração. Verifique a conexão com o MT5.");
        }
    };
    
    // Importar backtest
    const importBacktest = async () => {
        try {
            if (!selectedFile || !selectedEAForBacktest) {
                return;
            }
            
            setIsBacktestModalOpen(false);
            setIsExtracting(true);
            setExtractionProgress(0);
            
            // Fazer upload do arquivo
            const result = await backtestService.importBacktest(selectedFile, selectedEAForBacktest);
            
            // Simular progresso
            const interval = setInterval(() => {
                setExtractionProgress((prev) => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setTimeout(() => {
                            setIsExtracting(false);
                            setLastExtraction('Agora mesmo (Backtesting)');
                            
                            // Recarregar EAs após importação
                            eaService.listEAs().then(data => setEas(data));
                        }, 500);
                        return 100;
                    }
                    return prev + 5;
                });
            }, 300);
        } catch (error) {
            console.error("Erro ao importar backtest:", error);
            setIsExtracting(false);
            setError("Falha ao importar backtest.");
        }
    };
    
    // File upload handlers
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    // Get status color based on adherence percentage
    const getStatusColor = (adherence) => {
        if (adherence >= 90) return '#28A745';
        if (adherence >= 80) return '#FFC107';
        return '#DC3545';
    };

    // Get status glow class based on adherence percentage
    const getStatusGlowClass = (adherence) => {
        if (adherence >= 90) return 'neon-glow-green';
        if (adherence >= 80) return 'neon-glow-yellow';
        return 'neon-glow-red';
    };

    // Render mini trend chart
    const renderMiniTrend = (trendData) => {
        if (!trendData || trendData.length === 0) return null;
        
        const max = Math.max(...trendData);
        const min = Math.min(...trendData);
        const range = max - min;

        return (
            <div className="flex items-end h-10 gap-1 mt-3" data-oid="uy1unqt">
                {trendData.map((value, index) => {
                    const height = range === 0 ? 100 : ((value - min) / range) * 100;
                    const color = value >= 90 ? '#28A745' : value >= 80 ? '#FFC107' : '#DC3545';
                    return (
                        <div
                            key={index}
                            className="w-full rounded-sm relative group"
                            style={{
                                height: `${Math.max(20, height)}%`,
                                backgroundColor: color,
                                opacity: 0.8,
                                transition: 'all 0.3s ease',
                            }}
                            data-oid="x99kp-r"
                        >
                            <div
                                className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-[#240046] text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                                data-oid="a1x8383"
                            >
                                {value}%
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Mostrar indicador de carregamento
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#240046] to-[#3C096C]">
                <div className="text-white text-center">
                    <div className="w-16 h-16 border-4 border-[#7B2CBF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-xl">Carregando Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen font-['Inter',system-ui,sans-serif] text-white"
            data-oid="ih_ymk8"
        >
            {/* Header */}
            <header
                className="header-gradient h-[70px] border-b border-[#9D4EDD] px-6 flex items-center justify-between shadow-md sticky top-0 z-10 neon-glow"
                data-oid="54u5cj9"
            >
                <div className="flex items-center" data-oid="5bq3:ou">
                    <div
                        className="w-10 h-10 rounded-full bg-[#7B2CBF] flex items-center justify-center mr-4 neon-glow"
                        data-oid="ieq1vdb"
                    >
                        <span className="text-xl font-bold" data-oid="la0sl0g">
                            PANTER
                        </span>
                    </div>
                    <h1
                        className="text-2xl font-semibold right-auto bottom-auto absolute -left-[196px] top-[4px]"
                        data-oid="ikpa4z9"
                    >
                        Sistema de Verificação de Aderência MT5
                    </h1>
                </div>
                <div className="flex items-center gap-4" data-oid="2ejn0o_">
                    <div className="flex items-center mr-6" data-oid="yht1_m6">
                        <div
                            className={`w-3 h-3 rounded-full mr-2 ${mt5Connected ? 'bg-[#28A745]' : 'bg-[#DC3545]'}`}
                            data-oid="xcbert4"
                        ></div>
                        <span className="text-sm text-[#E0E0E0]" data-oid="3ud6t3t">
                            {mt5Connected ? 'MT5 Conectado' : 'MT5 Desconectado'}
                        </span>
                    </div>
                    <button
                        onClick={() => setIsBacktestModalOpen(true)}
                        className="button-blue-gradient hover:brightness-110 text-white px-4 py-2 rounded-full transition-all duration-300 flex items-center neon-glow-blue"
                        data-oid="ynyndc."
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            data-oid="k21t8lu"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                data-oid="jv0.qy3"
                            />
                        </svg>
                        Importar Backtesting
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="button-gradient hover:brightness-110 text-white px-4 py-2 rounded-full transition-all duration-300 neon-glow"
                        data-oid="m6qfcqv"
                    >
                        Extrair Dados
                    </button>
                </div>
            </header>

            {/* Navigation */}
            <nav
                className="glassmorphism py-3 px-6 flex justify-between items-center"
                data-oid="3h2:vz4"
            >
                <div className="flex space-x-6" data-oid="jbd4m2y">
                    <button
                        className="text-white border-b-2 border-[#7B2CBF] py-1 px-2"
                        data-oid="9548b34"
                    >
                        Dashboard
                    </button>
                    <button
                        className="text-[#E0E0E0] hover:text-white py-1 px-2 transition-colors"
                        data-oid="dow_7b7"
                    >
                        Relatórios
                    </button>
                    <button
                        className="text-[#E0E0E0] hover:text-white py-1 px-2 transition-colors"
                        data-oid="8j_nl:a"
                    >
                        Configuração
                    </button>
                    <button
                        className="text-[#E0E0E0] hover:text-white py-1 px-2 transition-colors"
                        data-oid="_n:mv6."
                    >
                        Ajuda
                    </button>
                </div>
                <div className="flex items-center gap-4" data-oid="vtkxjz:">
                    <div className="relative" data-oid="wdo-k:b">
                        <select
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                            className="bg-[#3C096C] text-white border border-[#9D4EDD] rounded-md px-3 py-1 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-[#7B2CBF]"
                            data-oid="56ca6km"
                        >
                            <option data-oid="_k-pl0q">Hoje</option>
                            <option data-oid="xs:33b-">Semana</option>
                            <option data-oid="c6dh9et">Mês</option>
                            <option data-oid="2y_cbj8">Trimestre</option>
                            <option data-oid="yp9rqir">Personalizado</option>
                        </select>
                        <div
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none"
                            data-oid="rfg7g.l"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                data-oid="3bgf5s6"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                    data-oid="8x55jrq"
                                />
                            </svg>
                        </div>
                    </div>
                    <div className="relative" data-oid="-.m2s_2">
                        <button
                            className="text-white hover:text-[#9D4EDD] transition-colors"
                            data-oid="-y6r.p2"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                data-oid="55gd2da"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                    data-oid="1qqd3o:"
                                />
                            </svg>
                        </button>
                        <div
                            className="absolute top-0 right-0 w-2 h-2 bg-[#DC3545] rounded-full"
                            data-oid="r4d3fcq"
                        ></div>
                    </div>
                </div>
            </nav>

            {/* Status Bar */}
            <div
                className="bg-[#240046] border-b border-[#9D4EDD] py-2 px-6 text-sm text-[#E0E0E0] flex justify-between items-center"
                data-oid="i87tna:"
            >
                <div data-oid="jldromn">
                    Última extração:{' '}
                    <span className="text-white" data-oid="flh4dk9">
                        {lastExtraction || 'Nenhuma'}
                    </span>
                </div>
                <div className="flex gap-6" data-oid="u.l:2ii">
                    <div data-oid="gl:eset">
                        Total de EAs:{' '}
                        <span className="text-white font-medium" data-oid="mzfq0uf">
                            {systemSummary.totalEAs}
                        </span>
                    </div>
                    <div data-oid="g5qo3mi">
                        Aderência média:{' '}
                        <span className="text-white font-medium" data-oid="w2w:.ls">
                            {systemSummary.avgAdherence}%
                        </span>
                    </div>
                    <div data-oid="-4tm95z">
                        Total de operações:{' '}
                        <span className="text-white font-medium" data-oid=":e.59mm">
                            {systemSummary.totalOperations}
                        </span>
                    </div>
                    <div data-oid="gvbfxrk">
                        Slippage médio:{' '}
                        <span className="text-white font-medium" data-oid="s28qxdw">
                            {systemSummary.avgSlippage}%
                        </span>
                    </div>
                </div>
            </div>

            {/* System Summary */}
            <div className="px-6 py-6" data-oid="zc0to:c">
                <h2 className="text-xl font-semibold mb-4" data-oid="ozqn6tf">
                    Resumo do Sistema
                </h2>
                <div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                    data-oid="kp0qpbm"
                >
                    <div className="glassmorphism rounded-lg p-4 neon-glow" data-oid="_aovsj1">
                        <div className="text-[#E0E0E0] text-sm mb-1" data-oid="blfk73_">
                            Total de EAs
                        </div>
                        <div className="text-3xl font-bold" data-oid="kulge_1">
                            {systemSummary.totalEAs}
                        </div>
                        <div className="mt-2 text-xs text-[#9D4EDD]" data-oid="8a68h9-">
                            Todos ativos
                        </div>
                    </div>
                    <div className="glassmorphism rounded-lg p-4 neon-glow" data-oid="e2tqflf">
                        <div className="text-[#E0E0E0] text-sm mb-1" data-oid="973.q.7">
                            Aderência Média
                        </div>
                        <div className="text-3xl font-bold" data-oid="i28.mfc">
                            {systemSummary.avgAdherence}%
                        </div>
                        <div className="mt-2 text-xs text-[#9D4EDD]" data-oid="6yvnbrp">
                            Últimos 7 dias
                        </div>
                    </div>
                    <div className="glassmorphism rounded-lg p-4 neon-glow" data-oid=".k_mukt">
                        <div className="text-[#E0E0E0] text-sm mb-1" data-oid="u1tw67l">
                            Total de Operações
                        </div>
                        <div className="text-3xl font-bold" data-oid="s-1kp6i">
                            {systemSummary.totalOperations}
                        </div>
                        <div className="mt-2 text-xs text-[#9D4EDD]" data-oid="zn4wmxj">
                            Período atual
                        </div>
                    </div>
                    <div className="glassmorphism rounded-lg p-4 neon-glow" data-oid="jo0g7q0">
                        <div className="text-[#E0E0E0] text-sm mb-1" data-oid="lgui.ve">
                            Slippage Médio
                        </div>
                        <div className="text-3xl font-bold" data-oid="ec1uy2j">
                            {systemSummary.avgSlippage}%
                        </div>
                        <div className="mt-2 text-xs text-[#9D4EDD]" data-oid="bw7:umg">
                            Todas operações
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Dashboard */}
            <main className="container mx-auto px-6 py-6" data-oid="sox-x_-">
                <h2 className="text-xl font-semibold mb-4" data-oid="kqdfdxx">
                    Expert Advisors
                </h2>
                <div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    data-oid="tvh29-6"
                >
                    {eas.map((ea) => (
                        <div
                            key={ea.id}
                            className={`card-gradient rounded-lg p-6 h-[200px] cursor-pointer transition-all duration-300 hover:translate-y-[-5px] relative overflow-hidden ${getStatusGlowClass(ea.metrics?.adherenceRate || 0)}`}
                            onClick={() => setSelectedEA(ea)}
                            data-oid="pi7_we5"
                        >
                            <div className="flex justify-between items-start" data-oid="g1oljb_">
                                <h3 className="text-lg font-medium text-white" data-oid="upw_7oe">
                                    {ea.name}
                                </h3>
                                <div
                                    className="w-[50px] h-[50px] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                                    style={{ backgroundColor: getStatusColor(ea.metrics?.adherenceRate || 0) }}
                                    data-oid="03qdrfx"
                                >
                                    {ea.metrics?.adherenceRate || 0}%
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4" data-oid="xa0tgj:">
                                <div data-oid="appmf2g">
                                    <div className="text-[#E0E0E0] text-xs" data-oid=":-6mjjl">
                                        Operações
                                    </div>
                                    <div className="text-white font-medium" data-oid="5um4fn3">
                                        {ea.metrics?.operations || 0}
                                    </div>
                                </div>
                                <div data-oid="31lm6zc">
                                    <div className="text-[#E0E0E0] text-xs" data-oid="b4sid0m">
                                        Slippage
                                    </div>
                                    <div className="text-white font-medium" data-oid="tgv37uq">
                                        {ea.metrics?.slippage || 0}%
                                    </div>
                                </div>
                            </div>

                            {renderMiniTrend(ea.metrics?.trend || [])}

                            <div
                                className="absolute inset-0 bg-gradient-to-t from-[#240046] to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4"
                                data-oid="ypmg-.0"
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEA(ea);
                                    }}
                                    className="button-gradient px-4 py-2 rounded-full text-white font-medium hover:brightness-110 transition-all duration-200 neon-glow"
                                    data-oid="xvr:wmk"
                                >
                                    Ver detalhes
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer with Timeline */}
            <footer
                className="glassmorphism mt-6 py-4 px-6 border-t border-[#9D4EDD]"
                data-oid="ckwrixh"
            >
                <div className="flex justify-between items-center" data-oid="y0-cewc">
                    <div className="text-sm text-[#E0E0E0]" data-oid="_z4hjrq">
                        © 2023 Sistema de Verificação de Aderência MT5
                    </div>
                    <div className="flex items-center" data-oid="p5.5_gn">
                        <div
                            className={`w-3 h-3 rounded-full ${mt5Connected ? 'bg-[#28A745]' : 'bg-[#DC3545]'} mr-2`}
                            data-oid="14k-nem"
                        ></div>
                        <span className="text-sm text-[#E0E0E0]" data-oid="bziyx-a">
                            {mt5Connected ? 'Sistema operando normalmente' : 'Sistema desconectado'}
                        </span>
                    </div>
                </div>

                {/* Timeline */}
                <div className="mt-4 relative" data-oid="43ejda_">
                    <div className="h-1 bg-[#3C096C] rounded-full w-full" data-oid="t:0do14"></div>
                    <div
                        className="absolute top-0 left-0 h-1 bg-[#7B2CBF] rounded-full"
                        style={{ width: '65%' }}
                        data-oid="uz_hq0."
                    ></div>
                    <div
                        className="flex justify-between mt-2 text-xs text-[#E0E0E0]"
                        data-oid="ge11anc"
                    >
                        <div data-oid=":cge4-t">00:00</div>
                        <div data-oid="_ilu2in">06:00</div>
                        <div data-oid="zd-4y4l">12:00</div>
                        <div data-oid="7qn4-ju">18:00</div>
                        <div data-oid="7nn6d:e">24:00</div>
                    </div>
                    <div
                        className="absolute top-[-4px] left-[65%] w-3 h-3 bg-[#9D4EDD] rounded-full"
                        data-oid="ei8eeg0"
                    ></div>
                </div>
            </footer>

            {/* Extraction Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20 animate-fadeIn"
                    data-oid="95itq1z"
                >
                    <div
                        className="glassmorphism rounded-lg w-[500px] max-w-[90%] animate-scaleIn neon-glow"
                        data-oid="b7ix597"
                    >
                        <div
                            className="header-gradient h-[60px] rounded-t-lg px-6 flex items-center justify-between"
                            data-oid="421c2pi"
                        >
                            <h2 className="text-lg font-medium text-white" data-oid="u9ypdqp">
                                Extração de Dados
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-[#E0E0E0] hover:text-white transition-colors"
                                data-oid="g0xmd57"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6" data-oid="g17fcwq">
                            <div className="mb-6" data-oid=".kxm0ho">
                                <label
                                    className="block text-sm font-medium mb-2 text-white"
                                    data-oid="9cd1ls."
                                >
                                    Período de Extração
                                </label>
                                <div className="flex gap-2" data-oid="al8hbp-">
                                    {['7dias', '15dias', '30dias', 'Personalizado'].map(
                                        (option) => (
                                            <button
                                                key={option}
                                                onClick={() => setPeriodOption(option)}
                                                className={`w-[90px] h-[36px] text-sm rounded-full transition-all duration-200 ${
                                                    periodOption === option
                                                        ? 'button-gradient text-white neon-glow'
                                                        : 'bg-[#240046] border border-[#9D4EDD] text-[#E0E0E0] hover:border-[#7B2CBF]'
                                                }`}
                                                data-oid="4.sgwc2"
                                            >
                                                {option}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>

                            {periodOption === 'Personalizado' && (
                                <div className="mb-6 grid grid-cols-2 gap-4" data-oid="ezi_acn">
                                    <div data-oid="wz0maha">
                                        <label
                                            className="block text-sm font-medium mb-2 text-white"
                                            data-oid="avwxccn"
                                        >
                                            Data Inicial
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full h-[40px] px-3 bg-[#240046] border border-[#9D4EDD] rounded text-white focus:outline-none focus:ring-2 focus:ring-[#7B2CBF]"
                                            data-oid="hwl9pf_"
                                        />
                                    </div>
                                    <div data-oid="szr780q">
                                        <label
                                            className="block text-sm font-medium mb-2 text-white"
                                            data-oid="k1vsuh4"
                                        >
                                            Data Final
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full h-[40px] px-3 bg-[#240046] border border-[#9D4EDD] rounded text-white focus:outline-none focus:ring-2 focus:ring-[#7B2CBF]"
                                            data-oid="lug8ie3"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center mb-6" data-oid="s6edvxm">
                                <div
                                    className={`w-3 h-3 rounded-full mr-2 ${mt5Connected ? 'bg-[#28A745]' : 'bg-[#DC3545]'}`}
                                    data-oid="f8eo9hk"
                                ></div>
                                <span className="text-sm text-white" data-oid="bo0ezd0">
                                    {mt5Connected ? 'MT5 Conectado' : 'MT5 Desconectado'}
                                </span>
                            </div>

                            <div className="flex justify-end gap-3 mt-6" data-oid="g31kzaa">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="h-[40px] px-6 bg-transparent border border-[#9D4EDD] text-[#E0E0E0] rounded-full hover:text-white transition-colors"
                                    data-oid="l2pwq01"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={startExtraction}
                                    className="h-[40px] px-6 button-gradient hover:brightness-110 text-white rounded-full transition-all duration-200 neon-glow"
                                    disabled={!mt5Connected}
                                    data-oid="ahd:x-7"
                                >
                                    Iniciar Extração
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Backtesting Import Modal */}
            {isBacktestModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20 animate-fadeIn"
                    data-oid="upf1gny"
                >
                    <div
                        className="glassmorphism rounded-lg w-[600px] max-w-[90%] animate-scaleIn neon-glow-blue"
                        data-oid="zeeoytx"
                    >
                        <div
                            className="header-gradient h-[60px] rounded-t-lg px-6 flex items-center justify-between"
                            data-oid="je.ih5p"
                        >
                            <h2 className="text-lg font-medium text-white" data-oid="3ceadb9">
                                Importar Dados de Backtesting
                            </h2>
                            <button
                                onClick={() => setIsBacktestModalOpen(false)}
                                className="text-[#E0E0E0] hover:text-white transition-colors"
                                data-oid="xl3jdly"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6" data-oid="5lm6zp6">
                            <div className="mb-6" data-oid="hmx8u5d">
                                <label
                                    className="block text-sm font-medium mb-2 text-white"
                                    data-oid="mn06k3m"
                                >
                                    Selecione o EA para associar ao backtesting
                                </label>
                                <select
                                    value={selectedEAForBacktest || ''}
                                    onChange={(e) => setSelectedEAForBacktest(e.target.value)}
                                    className="w-full h-[40px] px-3 bg-[#240046] border border-[#9D4EDD] rounded text-white focus:outline-none focus:ring-2 focus:ring-[#7B2CBF]"
                                    data-oid="kwmh5a9"
                                >
                                    <option value="" data-oid="2hkvwm_">
                                        Selecione um EA
                                    </option>
                                    {eas.map((ea) => (
                                        <option key={ea.id} value={ea.id} data-oid="34elf..">
                                            {ea.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div
                                className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                                    isDragging
                                        ? 'border-[#5390D9] bg-[#240046]'
                                        : 'border-[#9D4EDD]'
                                } ${selectedFile ? 'border-[#28A745]' : ''}`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                data-oid="v785:p7"
                            >
                                {selectedFile ? (
                                    <div className="text-white" data-oid="xfmy1:q">
                                        <div
                                            className="flex items-center justify-center mb-2"
                                            data-oid="cpe0q0q"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-8 w-8 text-[#28A745]"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                data-oid="d:gukih"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M5 13l4 4L19 7"
                                                    data-oid="o3gjw3l"
                                                />
                                            </svg>
                                        </div>
                                        <p className="font-medium" data-oid="9jte14q">
                                            {selectedFile.name}
                                        </p>
                                        <p
                                            className="text-sm text-[#E0E0E0] mt-1"
                                            data-oid="je9m2zc"
                                        >
                                            {(selectedFile.size / 1024).toFixed(2)} KB
                                        </p>
                                        <button
                                            onClick={() => setSelectedFile(null)}
                                            className="mt-3 text-[#9D4EDD] hover:text-[#7B2CBF] text-sm"
                                            data-oid="b0r3t-a"
                                        >
                                            Remover arquivo
                                        </button>
                                    </div>
                                ) : (
                                    <div data-oid="7u849av">
                                        <div
                                            className="flex items-center justify-center mb-4"
                                            data-oid="7pznhts"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-12 w-12 text-[#9D4EDD]"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                data-oid=".nw3o-q"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                    data-oid="t1lnn7m"
                                                />
                                            </svg>
                                        </div>
                                        <p className="text-white font-medium" data-oid="2q71f:k">
                                            Arraste e solte o arquivo de backtesting aqui
                                        </p>
                                        <p
                                            className="text-[#E0E0E0] text-sm mt-1"
                                            data-oid="84wbl4z"
                                        >
                                            ou
                                        </p>
                                        <div className="mt-3" data-oid="6pnh:ox">
                                            <label
                                                className="button-blue-gradient px-4 py-2 rounded-full text-white cursor-pointer inline-block hover:brightness-110 transition-all duration-200"
                                                data-oid="aq1k1h2"
                                            >
                                                Selecionar arquivo
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                    accept=".csv,.xml,.hst,.txt"
                                                    data-oid="g75se.7"
                                                />
                                            </label>
                                        </div>
                                        <p
                                            className="text-[#E0E0E0] text-xs mt-3"
                                            data-oid="kw4.wob"
                                        >
                                            Formatos suportados: .csv, .xml, .hst, .txt
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mb-6" data-oid="hi.:vt8">
                                <label
                                    className="block text-sm font-medium mb-2 text-white"
                                    data-oid="3zoekye"
                                >
                                    Configurações de Parâmetros
                                </label>
                                <div
                                    className="bg-[#240046] border border-[#9D4EDD] rounded p-4"
                                    data-oid="om2o0e2"
                                >
                                    <div className="grid grid-cols-2 gap-4" data-oid="iu6k0ai">
                                        <div data-oid="-8jguw_">
                                            <label
                                                className="block text-xs text-[#E0E0E0] mb-1"
                                                data-oid="yvq1fh5"
                                            >
                                                Timeframe
                                            </label>
                                            <select
                                                className="w-full h-[36px] px-3 bg-[#3C096C] border border-[#9D4EDD] rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#7B2CBF]"
                                                data-oid="-pl8kwx"
                                            >
                                                <option data-oid="d-i3-_h">M1</option>
                                                <option data-oid="llbpgi_">M5</option>
                                                <option data-oid="f68x-jm">M15</option>
                                                <option data-oid="v8mvinz">M30</option>
                                                <option data-oid="kr9yaq.">H1</option>
                                                <option data-oid="0-yn:mx">H4</option>
                                                <option data-oid="3e-icz.">D1</option>
                                            </select>
                                        </div>
                                        <div data-oid="izic:9v">
                                            <label
                                                className="block text-xs text-[#E0E0E0] mb-1"
                                                data-oid="f.rpq8b"
                                            >
                                                Símbolo
                                            </label>
                                            <select
                                                className="w-full h-[36px] px-3 bg-[#3C096C] border border-[#9D4EDD] rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#7B2CBF]"
                                                data-oid="y33024f"
                                            >
                                                <option data-oid="do3:b_5">EURUSD</option>
                                                <option data-oid="wteca1u">GBPUSD</option>
                                                <option data-oid="tv3tbl9">USDJPY</option>
                                                <option data-oid="mu3wqe_">AUDUSD</option>
                                                <option data-oid="1tqgl08">USDCAD</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6" data-oid="7fk8rwv">
                                <button
                                    onClick={() => setIsBacktestModalOpen(false)}
                                    className="h-[40px] px-6 bg-transparent border border-[#9D4EDD] text-[#E0E0E0] rounded-full hover:text-white transition-colors"
                                    data-oid="nb.bjqd"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={importBacktest}
                                    className="h-[40px] px-6 button-blue-gradient hover:brightness-110 text-white rounded-full transition-all duration-200 neon-glow-blue"
                                    disabled={!selectedFile || !selectedEAForBacktest}
                                    data-oid="h._-xjv"
                                >
                                    Importar Backtesting
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Extraction Progress */}
            {isExtracting && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20"
                    data-oid="5fjasdv"
                >
                    <div
                        className="glassmorphism rounded-lg w-[500px] max-w-[90%] p-6 neon-glow"
                        data-oid="bb086ul"
                    >
                        <h2 className="text-lg font-medium mb-4 text-white" data-oid="hk143g4">
                            Processamento em Andamento
                        </h2>

                        <div className="mb-6" data-oid="kwhdrfc">
                            <div
                                className="relative h-[20px] bg-[#240046] rounded-[10px] overflow-hidden"
                                data-oid="7ym8vpp"
                            >
                                <div
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#7B2CBF] to-[#9D4EDD] transition-all duration-300 flex items-center justify-center"
                                    style={{ width: `${extractionProgress}%` }}
                                    data-oid="k6v_0eh"
                                >
                                    <span
                                        className="text-white text-xs font-medium"
                                        data-oid="_g:1nyq"
                                    >
                                        {extractionProgress}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div
                            className="bg-[#240046] border border-[#9D4EDD] p-4 rounded mb-4"
                            data-oid="_-xxfzv"
                        >
                            <p className="text-center text-white" data-oid="dktuxqi">
                                Processando: {Math.floor(extractionProgress * 1.2)}/120 operações
                            </p>
                        </div>

                        <div className="flex justify-center" data-oid="3zv38pg">
                            <button
                                onClick={() => {
                                    setIsExtracting(false);
                                    if (activeExtraction) {
                                        extractionService.cancelExtraction(activeExtraction);
                                    }
                                }}
                                className="h-[36px] w-[120px] border border-[#9D4EDD] text-[#E0E0E0] rounded-full hover:text-white transition-colors"
                                data-oid="q6hz_yr"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EA Detail View */}
            {selectedEA && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20 animate-fadeIn"
                    data-oid="1pxali0"
                >
                    <div
                        className="glassmorphism rounded-lg w-[90%] max-w-[1000px] h-[90vh] overflow-auto animate-scaleIn neon-glow"
                        data-oid="eiva2vo"
                    >
                        <div
                            className="header-gradient h-[70px] rounded-t-lg px-6 flex items-center justify-between sticky top-0 z-10"
                            data-oid="kkuhjzk"
                        >
                            <div className="flex items-center" data-oid="o2iwgog">
                                <h2 className="text-xl font-semibold text-white" data-oid="pt_fe0n">
                                    {selectedEA.name}
                                </h2>
                                <div
                                    className="ml-4 w-[40px] h-[40px] rounded-full flex items-center justify-center text-white text-sm font-bold"
                                    style={{
                                        backgroundColor: getStatusColor(selectedEA.metrics?.adherenceRate || 0),
                                    }}
                                    data-oid="u6vmcvr"
                                >
                                    {selectedEA.metrics?.adherenceRate || 0}%
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedEA(null)}
                                className="text-[#E0E0E0] hover:text-white transition-colors"
                                data-oid="9l8bds6"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6" data-oid="m_273q0">
                            <div
                                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                                data-oid="yd9w2mc"
                            >
                                {/* Charts Section */}
                                <div
                                    className="card-gradient rounded-lg p-6 shadow-lg"
                                    data-oid="oji87ot"
                                >
                                    <h3
                                        className="text-lg font-medium mb-6 text-white"
                                        data-oid="f5xu5tm"
                                    >
                                        Comparativo de Desempenho
                                    </h3>
                                    <div className="h-[300px] flex items-end" data-oid="el3t8hf">
                                        <div
                                            className="flex-1 flex items-end justify-around h-full"
                                            data-oid="uyz6qcv"
                                        >
                                            <div
                                                className="flex flex-col items-center"
                                                data-oid="7cju28j"
                                            >
                                                <div
                                                    className="text-sm text-[#E0E0E0] mb-2"
                                                    data-oid="_6szw:-"
                                                >
                                                    Backtest
                                                </div>
                                                <div
                                                    className="w-[80px] bg-gradient-to-t from-[#5390D9] to-[#4361EE] h-[70%] rounded-t-lg neon-glow-blue"
                                                    data-oid="px9sjsb"
                                                ></div>
                                                <div
                                                    className="mt-3 font-mono text-white"
                                                    data-oid="8j.lt4w"
                                                >
                                                    +12.5%
                                                </div>
                                            </div>
                                            <div
                                                className="flex flex-col items-center"
                                                data-oid="svz9abg"
                                            >
                                                <div
                                                    className="text-sm text-[#E0E0E0] mb-2"
                                                    data-oid="5d:sn6l"
                                                >
                                                    Real
                                                </div>
                                                <div
                                                    className="w-[80px] bg-gradient-to-t from-[#28A745] to-[#34D058] h-[65%] rounded-t-lg neon-glow-green"
                                                    data-oid="2-bm-wp"
                                                ></div>
                                                <div
                                                    className="mt-3 font-mono text-white"
                                                    data-oid="x-keyo7"
                                                >
                                                    +11.8%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Table Section */}
                                <div
                                    className="card-gradient rounded-lg p-6 shadow-lg"
                                    data-oid="qmuld5."
                                >
                                    <h3
                                        className="text-lg font-medium mb-4 text-white"
                                        data-oid="tbk56vs"
                                    >
                                        Operações Recentes
                                    </h3>
                                    <div className="overflow-x-auto" data-oid="a3mjjxj">
                                        <table
                                            className="w-full border-collapse"
                                            data-oid="o7z3rj:"
                                        >
                                            <thead data-oid="qqu:16_">
                                                <tr
                                                    className="border-b border-[#9D4EDD] text-left"
                                                    data-oid="6.fqkeh"
                                                >
                                                    <th
                                                        className="p-3 text-[#E0E0E0]"
                                                        data-oid="i7_6h_p"
                                                    >
                                                        Data
                                                    </th>
                                                    <th
                                                        className="p-3 text-[#E0E0E0]"
                                                        data-oid="b2s9g48"
                                                    >
                                                        Tipo
                                                    </th>
                                                    <th
                                                        className="p-3 text-[#E0E0E0]"
                                                        data-oid="ufya5hh"
                                                    >
                                                        Símbolo
                                                    </th>
                                                    <th
                                                        className="p-3 text-right text-[#E0E0E0]"
                                                        data-oid="ifr-zh7"
                                                    >
                                                        Resultado
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody data-oid="m5e:8g5">
                                                {(selectedEA.operations || []).map((op, index) => (
                                                    <tr
                                                        key={index}
                                                        className="border-b border-[#3C096C] hover:bg-[#3C096C] transition-colors"
                                                        data-oid="v64en_b"
                                                    >
                                                        <td
                                                            className="p-3 text-white"
                                                            data-oid="-862c-b"
                                                        >
                                                            {op.date}
                                                        </td>
                                                        <td
                                                            className="p-3 text-white"
                                                            data-oid=":.d1dd."
                                                        >
                                                            {op.type}
                                                        </td>
                                                        <td
                                                            className="p-3 text-white"
                                                            data-oid="t:9s95p"
                                                        >
                                                            {op.symbol}
                                                        </td>
                                                        <td
                                                            className="p-3 text-right font-mono"
                                                            data-oid="t_-donf"
                                                        >
                                                            <span
                                                                className={
                                                                    op.result.startsWith('+')
                                                                        ? 'text-[#28A745]'
                                                                        : 'text-[#DC3545]'
                                                                }
                                                                data-oid="s3a:r4b"
                                                            >
                                                                {op.result}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div
                                        className="flex justify-between items-center mt-4"
                                        data-oid="p9s2isf"
                                    >
                                        <div className="text-sm text-[#E0E0E0]" data-oid="gn31guq">
                                            Mostrando 1-5 de {selectedEA.metrics?.operations || 0}
                                        </div>
                                        <div className="flex gap-2" data-oid="-jv6i38">
                                            {[10, 25, 50].map((size) => (
                                                <button
                                                    key={size}
                                                    className="px-3 py-1 text-sm bg-[#240046] border border-[#9D4EDD] rounded hover:border-[#7B2CBF] text-white transition-colors"
                                                    data-oid="05u9-:7"
                                                >
                                                    {size}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end" data-oid="8pp8hyy">
                                <button
                                    onClick={() => setSelectedEA(null)}
                                    className="h-[40px] px-6 button-gradient hover:brightness-110 text-white rounded-full transition-all duration-200 neon-glow"
                                    data-oid="324.h_z"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Error message */}
            {error && (
                <div className="fixed bottom-4 right-4 bg-[#DC3545] text-white px-4 py-3 rounded-lg shadow-lg animate-slideUp">
                    <div className="flex items-center">
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-6 w-6 mr-2" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                            />
                        </svg>
                        <span>{error}</span>
                        <button 
                            className="ml-4 text-white hover:text-gray-200"
                            onClick={() => setError(null)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}