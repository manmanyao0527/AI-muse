import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Plus, 
  Search,
  Settings2,
  Paperclip,
  Maximize2,
  Send,
  User,
  Layers,
  Sparkles,
  X,
  RefreshCw,
  Download,
  ChevronRight,
  Timer,
  ChevronDown,
  LayoutDashboard,
  Calendar,
  Activity,
  ArrowLeft,
  Filter,
  Users,
  Box,
  TrendingUp,
  Terminal
} from 'lucide-react';
import { AppMode, DialogueSession, Message, AppConfig, CaseItem, DateLog, UserDailyStat } from './types';
import { DAILY_TOKEN_LIMIT, MODELS, IMAGE_RATIOS, VIDEO_RATIOS, VIDEO_DURATIONS, STYLES, CASES } from './constants';
import { AIService } from './services/geminiService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'chat' | 'logs'>('chat');
  const [activeLogTab, setActiveLogTab] = useState<'overview' | 'details'>('overview');
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.TEXT);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DialogueSession[]>([]);
  const [tokensUsed, setTokensUsed] = useState(12450);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<DateLog[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [config, setConfig] = useState<AppConfig>({
    model: MODELS.text[0],
    ratio: '1:1',
    style: STYLES[0],
    duration: VIDEO_DURATIONS[0],
    attachments: [],
    refImage: null,
    refVideo: null
  });

  const [activeDropdown, setActiveDropdown] = useState<'ratio' | 'duration' | 'model' | 'style' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userId = useMemo(() => {
    let id = localStorage.getItem('ai_user_id');
    if (!id) {
      id = 'U' + Math.random().toString(36).substr(2, 6).toUpperCase();
      localStorage.setItem('ai_user_id', id);
    }
    return id;
  }, []);

  useEffect(() => {
    const savedSessions = localStorage.getItem('ai_creative_sessions');
    if (savedSessions) setSessions(JSON.parse(savedSessions));

    const savedLogs = localStorage.getItem('ai_system_dashboard_logs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
    
    trackMetric(AppMode.TEXT, 'pv');
  }, []);

  const trackMetric = (mode: AppMode, type: 'pv' | 'points', value: number = 1) => {
    const today = new Date().toISOString().split('T')[0];
    const savedLogs = localStorage.getItem('ai_system_dashboard_logs');
    let currentLogs: DateLog[] = savedLogs ? JSON.parse(savedLogs) : [];
    
    let dayLog = currentLogs.find(l => l.date === today);
    if (!dayLog) {
      dayLog = { date: today, users: {} };
      currentLogs.push(dayLog);
    }

    if (!dayLog.users[userId]) {
      dayLog.users[userId] = {
        [AppMode.TEXT]: { pv: 0, points: 0 },
        [AppMode.IMAGE]: { pv: 0, points: 0 },
        [AppMode.VIDEO]: { pv: 0, points: 0 }
      };
    }

    const userStat = dayLog.users[userId][mode];
    if (type === 'pv') userStat.pv += value;
    if (type === 'points') userStat.points += value;

    setLogs([...currentLogs]);
    localStorage.setItem('ai_system_dashboard_logs', JSON.stringify(currentLogs));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isGenerating, activeView]);

  const switchMode = (mode: AppMode) => {
    setActiveView('chat');
    const newMode = (activeMode === mode) ? AppMode.TEXT : mode;
    setActiveMode(newMode);
    trackMetric(newMode, 'pv');
    
    const defaultModel = newMode === AppMode.TEXT ? MODELS.text[0] : (newMode === AppMode.IMAGE ? MODELS.image[0] : MODELS.video[0]);
    const defaultRatio = newMode === AppMode.VIDEO ? VIDEO_RATIOS[0] : IMAGE_RATIOS[0];
    
    setConfig(prev => ({
      ...prev,
      model: defaultModel,
      ratio: defaultRatio,
    }));
    setActiveDropdown(null);
  };

  const startNewSession = () => {
    setActiveView('chat');
    setActiveSessionId(null);
    setActiveMode(AppMode.TEXT);
    setInputPrompt('');
    setConfig({
      model: MODELS.text[0],
      ratio: '1:1',
      style: STYLES[0],
      duration: VIDEO_DURATIONS[0],
      attachments: [],
      refImage: null,
      refVideo: null
    });
  };

  const openSession = (session: DialogueSession) => {
    setActiveView('chat');
    setActiveMode(session.mode);
    setActiveSessionId(session.id);
    setConfig(session.params);
  };

  const currentSession = sessions.find(s => s.id === activeSessionId);

  const handleSubmit = async (overridePrompt?: string) => {
    const prompt = overridePrompt || inputPrompt;
    if (!prompt.trim() || isGenerating) return;

    const isVeoModel = config.model.includes('veo');
    const isProImageModel = config.model === 'gemini-3-pro-image-preview';

    if (isVeoModel || isProImageModel) {
      const aistudio = (window as any).aistudio;
      if (aistudio && !(await aistudio.hasSelectedApiKey())) {
        await aistudio.openSelectKey();
      }
    }

    setInputPrompt('');
    setIsGenerating(true);
    
    let sessionId = activeSessionId;
    let updatedSessions = [...sessions];
    
    if (!sessionId) {
      sessionId = Date.now().toString();
      const newSession: DialogueSession = {
        id: sessionId,
        mode: activeMode,
        title: prompt.slice(0, 30),
        messages: [],
        params: { ...config },
        timestamp: Date.now()
      };
      updatedSessions = [newSession, ...updatedSessions];
      setActiveSessionId(sessionId);
    }

    const sessionIndex = updatedSessions.findIndex(s => s.id === sessionId);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: prompt, timestamp: Date.now() };
    updatedSessions[sessionIndex].messages.push(userMsg);
    updatedSessions[sessionIndex].mode = activeMode;
    setSessions(updatedSessions);

    const service = AIService.getInstance();

    try {
      let result = '';
      let resultUrl = '';
      let pointCost = 0;
      const lastResultUrl = updatedSessions[sessionIndex].messages.filter(m => m.resultUrl).pop()?.resultUrl;

      if (activeMode === AppMode.TEXT) {
        result = (await service.generateText(prompt, config.model)) || '';
        pointCost = 500;
      } else if (activeMode === AppMode.IMAGE) {
        const url = await service.generateImage(prompt, config.model, config.ratio || '1:1', lastResultUrl || undefined);
        resultUrl = url || 'https://picsum.photos/800/600';
        pointCost = 2500;
      } else {
        const url = await service.generateVideo(prompt, config.model, config.ratio || '16:9');
        resultUrl = url || 'https://picsum.photos/800/600'; 
        pointCost = 5000;
      }

      setTokensUsed(prev => Math.min(DAILY_TOKEN_LIMIT, prev + pointCost));
      trackMetric(activeMode, 'points', pointCost);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result,
        resultUrl: resultUrl,
        timestamp: Date.now()
      };

      updatedSessions[sessionIndex].messages.push(aiMsg);
      setSessions([...updatedSessions]);
      localStorage.setItem('ai_creative_sessions', JSON.stringify(updatedSessions));
    } catch (err: any) {
      console.error(err);
      alert('生成失败，请检查配置或API Key');
    } finally {
      setIsGenerating(false);
    }
  };

  const useCase = (item: CaseItem) => {
    setActiveMode(item.type);
    setInputPrompt(item.prompt);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const toggleDropdown = (dropdown: 'ratio' | 'duration' | 'model' | 'style') => {
    setActiveDropdown(prev => prev === dropdown ? null : dropdown);
  };

  const landingCases = activeMode === AppMode.TEXT ? [] : CASES.filter(c => c.type === activeMode);

  const getModuleLabels = (mode: AppMode) => {
    const mapping = {
      [AppMode.TEXT]: '智能对话',
      [AppMode.IMAGE]: '图片生成',
      [AppMode.VIDEO]: '视频生成'
    };
    return { level1: 'AI创意', level2: mapping[mode] || mode };
  };

  const renderInputArea = () => (
    <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 p-2 transform transition-all hover:shadow-[0_25px_60px_rgba(0,0,0,0.12)] focus-within:ring-2 focus-within:ring-blue-100 relative w-full">
      <div className="flex flex-col">
        <textarea 
          ref={inputRef}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={activeMode === AppMode.TEXT ? "发消息、输入“@”引用或输入指令..." : (activeMode === AppMode.IMAGE ? "描述图片设计方案..." : "描述视频创作内容...")}
          className="w-full h-20 sm:h-24 resize-none text-base sm:text-lg text-gray-700 placeholder-gray-400 bg-transparent px-4 pt-4 focus:outline-none custom-scrollbar"
        />
        
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <div className="relative">
            <div 
              onClick={() => toggleDropdown('model')}
              className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer select-none"
            >
               <Settings2 size={12} className="mr-2 text-gray-400" />
               <span className="max-w-[120px] truncate">{config.model}</span>
               <ChevronDown size={12} className={`ml-1 text-gray-400 transition-transform ${activeDropdown === 'model' ? 'rotate-180' : ''}`} />
            </div>
            {activeDropdown === 'model' && (
              <div className="absolute bottom-full mb-2 left-0 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-bottom-2">
                {MODELS[activeMode === AppMode.TEXT ? 'text' : (activeMode === AppMode.IMAGE ? 'image' : 'video')].map(m => (
                  <button 
                    key={m}
                    onClick={() => { setConfig({...config, model: m}); setActiveDropdown(null); }}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 transition-colors ${config.model === m ? 'text-blue-600 font-bold' : 'text-gray-600'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1">
            <button 
              onClick={() => switchMode(AppMode.IMAGE)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 border ${activeMode === AppMode.IMAGE ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm ring-1 ring-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
            >
              <ImageIcon size={12} />
              <span>图片生成</span>
            </button>
            <button 
              onClick={() => switchMode(AppMode.VIDEO)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 border ${activeMode === AppMode.VIDEO ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm ring-1 ring-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
            >
              <VideoIcon size={12} />
              <span>视频生成</span>
            </button>
          </div>

          {(activeMode === AppMode.IMAGE || activeMode === AppMode.VIDEO) && (
            <>
              <div className="relative">
                <div onClick={() => toggleDropdown('ratio')} className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer select-none">
                   <Layers size={12} className="mr-2 text-gray-400" />
                   <span>比例：{config.ratio}</span>
                </div>
                {activeDropdown === 'ratio' && (
                  <div className="absolute bottom-full mb-2 left-0 w-32 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-bottom-2">
                    {(activeMode === AppMode.VIDEO ? VIDEO_RATIOS : IMAGE_RATIOS).map(r => (
                      <button key={r} onClick={() => { setConfig({...config, ratio: r}); setActiveDropdown(null); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 transition-colors ${config.ratio === r ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>{r}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <div onClick={() => toggleDropdown('style')} className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer select-none">
                   <Sparkles size={12} className="mr-2 text-gray-400" />
                   <span>风格：{config.style}</span>
                </div>
                {activeDropdown === 'style' && (
                  <div className="absolute bottom-full mb-2 left-0 w-32 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-bottom-2">
                    {STYLES.map(s => (
                      <button key={s} onClick={() => { setConfig({...config, style: s}); setActiveDropdown(null); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 transition-colors ${config.style === s ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="ml-auto flex items-center pr-2">
            <button 
              onClick={() => handleSubmit()}
              disabled={!inputPrompt.trim() || isGenerating}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${inputPrompt.trim() && !isGenerating ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 scale-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed scale-95'}`}
            >
              {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLogsView = () => {
    const filteredLogs = logs.filter(l => l.date.startsWith(selectedMonth));
    const moduleSummary: { [dateAndMode: string]: { date: string, mode: AppMode, pv: number, points: number, uvCount: number } } = {};
    const userSummary: { date: string, userId: string, mode: AppMode, pv: number, points: number }[] = [];
    
    let totalPv = 0;
    let totalPoints = 0;
    const monthUniqueUsers = new Set<string>();
    const userActiveDays: { [uid: string]: Set<string> } = {};

    filteredLogs.forEach(log => {
      Object.entries(log.users).forEach(([uId, modes]) => {
        monthUniqueUsers.add(uId);
        if (!userActiveDays[uId]) userActiveDays[uId] = new Set();

        Object.entries(modes as UserDailyStat).forEach(([mode, stat]) => {
          totalPv += stat.pv;
          totalPoints += stat.points;
          if (stat.pv > 0 || stat.points > 0) {
            userActiveDays[uId].add(log.date);
            const key = `${log.date}-${mode}`;
            if (!moduleSummary[key]) {
              moduleSummary[key] = { date: log.date, mode: mode as AppMode, pv: 0, points: 0, uvCount: 0 };
            }
            moduleSummary[key].pv += stat.pv;
            moduleSummary[key].points += stat.points;
            userSummary.push({ date: log.date, userId: uId, mode: mode as AppMode, pv: stat.pv, points: stat.points });
          }
        });
      });
      
      Object.keys(moduleSummary).forEach(key => {
        const [date, mode] = key.split('-');
        const currentLog = logs.find(l => l.date === date);
        if (currentLog) {
          const uvSet = new Set();
          Object.entries(currentLog.users).forEach(([uid, mStats]) => {
             const stat = mStats[mode];
             if (stat && (stat.pv > 0 || stat.points > 0)) uvSet.add(uid);
          });
          moduleSummary[key].uvCount = uvSet.size;
        }
      });
    });

    const mauCount = Object.keys(userActiveDays).filter(uId => userActiveDays[uId].size > 9).length;
    const sortedModuleSummary = Object.values(moduleSummary).sort((a, b) => b.date.localeCompare(a.date));
    const sortedUserSummary = userSummary.sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="max-w-6xl mx-auto w-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">系统日志</h2>
            <p className="text-sm text-gray-500">监控月度活跃度、资源消耗与行为流水</p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="flex items-center bg-gray-100 p-1 rounded-xl">
               <button 
                 onClick={() => setActiveLogTab('overview')}
                 className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeLogTab === 'overview' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 流水概览
               </button>
               <button 
                 onClick={() => setActiveLogTab('details')}
                 className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeLogTab === 'details' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 行为明细
               </button>
             </div>
             <div className="flex items-center space-x-2 bg-white border border-gray-100 rounded-xl px-3 py-1.5 shadow-sm">
                <Calendar size={14} className="text-gray-400" />
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none"
                />
             </div>
          </div>
        </div>

        {/* Metric Cards - PV, UV, Points, MAU */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center"><Activity className="text-blue-600" size={24} /></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">周期 PV</p><p className="text-2xl font-bold text-gray-800">{totalPv}</p></div>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center"><User className="text-indigo-600" size={24} /></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">活跃 UV</p><p className="text-2xl font-bold text-gray-800">{monthUniqueUsers.size}</p></div>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center"><Sparkles className="text-orange-600" size={24} /></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">消耗点数</p><p className="text-2xl font-bold text-gray-800">{totalPoints.toLocaleString()}</p></div>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex items-center space-x-4 border-l-4 border-l-blue-500">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center"><TrendingUp className="text-blue-600" size={24} /></div>
            <div><p className="text-xs font-bold text-blue-600 uppercase tracking-wider">月活 (MAU)</p><p className="text-2xl font-bold text-gray-800">{mauCount}</p><p className="text-[9px] text-gray-400 mt-1">月 UV > 9</p></div>
          </div>
        </div>

        {activeLogTab === 'overview' ? (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
              <h3 className="font-bold text-gray-800 flex items-center space-x-2"><Box size={18} className="text-blue-500" /><span>功能模块流水概览</span></h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-8 py-4">日期</th><th className="px-8 py-4">路径</th><th className="px-8 py-4">PV</th><th className="px-8 py-4">UV</th><th className="px-8 py-4">点数消耗</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedModuleSummary.map((row, idx) => {
                    const labels = getModuleLabels(row.mode);
                    return (
                      <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-4 text-xs font-medium text-gray-500">{row.date}</td>
                        <td className="px-8 py-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">{labels.level1}</span>
                            <span className="text-xs font-bold text-gray-800">{labels.level2}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-xs font-bold text-gray-800">{row.pv}</td>
                        <td className="px-8 py-4 text-xs font-bold text-gray-800">{row.uvCount}</td>
                        <td className="px-8 py-4 text-xs text-blue-600 font-bold">{row.points.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
              <h3 className="font-bold text-gray-800 flex items-center space-x-2"><Users size={18} className="text-indigo-500" /><span>用户审计明细</span></h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-8 py-4">日期</th><th className="px-8 py-4">用户名</th><th className="px-8 py-4">路径</th><th className="px-8 py-4">PV</th><th className="px-8 py-4">消耗</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedUserSummary.map((row, idx) => {
                    const labels = getModuleLabels(row.mode);
                    return (
                      <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-4 text-xs font-medium text-gray-500">{row.date}</td>
                        <td className="px-8 py-4 text-xs font-bold text-gray-800">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px]">{row.userId.charAt(0)}</div>
                            <span>{row.userId}</span>
                            {userActiveDays[row.userId]?.size > 9 && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-bold">MAU</span>}
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">{labels.level1}</span>
                            <ChevronRight size={10} className="text-gray-300" />
                            <span className="text-[10px] font-bold uppercase text-gray-600">{labels.level2}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-xs text-gray-600">{row.pv}</td>
                        <td className="px-8 py-4 text-xs text-blue-600 font-bold">{row.points.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden font-sans">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">AI创意</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <button 
            onClick={startNewSession}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${!activeSessionId && activeView === 'chat' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Plus size={20} />
            <span>新建会话</span>
          </button>
          
          <div className="pt-8">
            <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">历史记录</p>
            <div className="space-y-1">
              {sessions.length > 0 ? sessions.slice(0, 15).map(session => (
                <button 
                  key={session.id} 
                  className={`w-full text-left px-4 py-2.5 text-xs truncate rounded-lg transition-colors flex items-center space-x-2 ${activeSessionId === session.id && activeView === 'chat' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => openSession(session)}
                >
                  {session.mode === AppMode.TEXT ? <MessageSquare size={12} className="shrink-0" /> : session.mode === AppMode.IMAGE ? <ImageIcon size={12} className="shrink-0" /> : <VideoIcon size={12} className="shrink-0" />}
                  <span className="truncate">{session.title}</span>
                </button>
              )) : (
                <p className="px-4 py-2 text-xs text-gray-400 italic">暂无历史记录</p>
              )}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
           <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase">点数余额</span>
              <span className="text-xs font-bold text-blue-600">{(DAILY_TOKEN_LIMIT - tokensUsed).toLocaleString()}</span>
           </div>
           <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
              <div 
                className="h-full bg-blue-600 transition-all duration-700 ease-out" 
                style={{ width: `${(tokensUsed / DAILY_TOKEN_LIMIT) * 100}%` }}
              />
           </div>
           <p className="text-[9px] text-gray-400 mb-6 font-medium">每日零点重新获取点数</p>

           <div className="flex items-center space-x-3 p-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden">
                 <User size={18} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">当前访客</p>
                <p className="text-[10px] text-gray-400 truncate">ID: {userId}</p>
              </div>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-white">
        <header className="h-16 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20">
          <div className="flex items-center space-x-2">
             <span className="text-sm font-bold text-gray-800">
               {activeView === 'logs' ? '系统日志' : (activeMode === AppMode.TEXT ? '智能对话' : activeMode === AppMode.IMAGE ? '图片设计' : '视频生成')}
             </span>
             {activeSessionId && activeView === 'chat' && (
               <>
                 <ChevronRight size={14} className="text-gray-300" />
                 <span className="text-xs text-gray-400 truncate max-w-[200px]">{currentSession?.title}</span>
               </>
             )}
          </div>
          <div className="flex items-center space-x-3">
             <button 
               onClick={() => setActiveView(activeView === 'chat' ? 'logs' : 'chat')}
               className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${activeView === 'logs' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
             >
               {activeView === 'logs' ? <MessageSquare size={16} /> : <LayoutDashboard size={16} />}
               <span>{activeView === 'logs' ? '返回创作' : '系统日志'}</span>
             </button>
             <div className="w-px h-6 bg-gray-200 mx-1"></div>
             <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><Search size={18} /></button>
             <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><Maximize2 size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-8 py-8 flex flex-col">
          {activeView === 'logs' ? renderLogsView() : (
            <div className={`max-w-4xl mx-auto w-full flex flex-col space-y-8 ${!activeSessionId ? 'flex-1 justify-center items-center' : ''}`}>
              {!activeSessionId && !isGenerating && (
                <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                  {renderInputArea()}
                  {landingCases.length > 0 && (
                    <div className="mt-12 w-full grid gap-6 grid-cols-1 md:grid-cols-3">
                      {landingCases.map(item => (
                        <button key={item.id} onClick={() => useCase(item)} className="group relative flex flex-col items-start bg-white rounded-3xl border border-gray-100 hover:border-blue-200 hover:shadow-2xl transition-all overflow-hidden text-left">
                          {item.previewUrl && (
                            <div className="w-full aspect-video overflow-hidden bg-gray-100 relative">
                              {item.type === AppMode.VIDEO ? (
                                <video src={item.previewUrl} muted loop autoPlay playsInline className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                              ) : (
                                <img src={item.previewUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                 <span className="text-white text-xs font-bold flex items-center">点击载入方案 <ChevronRight size={14} className="ml-1" /></span>
                              </div>
                            </div>
                          )}
                          <div className="p-6 w-full">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl group-hover:bg-blue-50 group-hover:scale-110 transition-transform mb-3">
                              {item.icon}
                            </div>
                            <p className="text-base font-bold text-gray-800 mb-1">{item.title}</p>
                            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{item.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentSession?.messages.map((msg) => (
                <div key={msg.id} className="flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] bg-blue-600 text-white rounded-3xl rounded-tr-sm px-6 py-4 shadow-lg shadow-blue-500/20">
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[90%] bg-gray-50 border border-gray-100 rounded-3xl rounded-tl-sm p-6 space-y-4 w-full">
                        <div className="flex items-center space-x-2 mb-2">
                           <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                              <Sparkles size={12} className="text-blue-600" />
                           </div>
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI 响应</span>
                        </div>
                        {msg.resultUrl && (
                          <div className="rounded-2xl overflow-hidden shadow-sm bg-white group relative max-w-2xl">
                            {activeMode === AppMode.VIDEO ? <video src={msg.resultUrl} controls className="w-full max-h-[500px]" /> : <img src={msg.resultUrl} alt="Result" className="w-full max-h-[500px] object-contain" />}
                            <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors"><Download size={16} className="text-gray-700" /></button>
                               <button className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors"><RefreshCw size={16} className="text-gray-700" /></button>
                            </div>
                          </div>
                        )}
                        {msg.content && <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.content}</div>}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                           <p className="text-[10px] text-gray-400">已自动为您保存到历史记录</p>
                           <div className="flex items-center space-x-4">
                             <button className="text-[10px] font-bold text-blue-600 hover:underline">继续微调</button>
                             <button className="text-[10px] font-bold text-gray-400 hover:text-gray-600">不满意？</button>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl rounded-tl-sm p-6 w-full max-w-sm">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">深度计算中...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {activeSessionId && activeView === 'chat' && (
          <div className="p-4 sm:p-8 bg-gradient-to-t from-white via-white to-transparent sticky bottom-0 z-10" ref={dropdownRef}>
            <div className="max-w-4xl mx-auto">
              {renderInputArea()}
              <p className="text-center text-[10px] text-gray-400 mt-4 px-4 font-medium uppercase tracking-widest">Enterprise AI Laboratory</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;