
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Plus, 
  Clock, 
  Search,
  Settings2,
  Paperclip,
  Maximize2,
  Send,
  User,
  FileVideo,
  Layers,
  Sparkles,
  X,
  RefreshCw,
  Download,
  ChevronRight,
  Timer,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';
import { AppMode, DialogueSession, Message, AppConfig, CaseItem } from './types';
import { DAILY_TOKEN_LIMIT, MODELS, IMAGE_RATIOS, VIDEO_RATIOS, VIDEO_DURATIONS, STYLES, CASES } from './constants';
import { AIService } from './services/geminiService';

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.TEXT);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DialogueSession[]>([]);
  const [tokensUsed, setTokensUsed] = useState(12450);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Load sessions on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai_creative_sessions');
    if (saved) setSessions(JSON.parse(saved));
  }, []);

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
  }, [sessions, activeSessionId, isGenerating]);

  // Mode switching within the same session
  const switchMode = (mode: AppMode) => {
    const newMode = (activeMode === mode) ? AppMode.TEXT : mode;
    setActiveMode(newMode);
    
    // Update config to appropriate model for the new mode
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
      const lastResultUrl = updatedSessions[sessionIndex].messages.filter(m => m.resultUrl).pop()?.resultUrl;

      if (activeMode === AppMode.TEXT) {
        result = (await service.generateText(prompt, config.model)) || '';
        setTokensUsed(prev => Math.min(DAILY_TOKEN_LIMIT, prev + 500));
      } else if (activeMode === AppMode.IMAGE) {
        const url = await service.generateImage(
          prompt, 
          config.model, 
          config.ratio || '1:1',
          lastResultUrl || undefined
        );
        resultUrl = url || 'https://picsum.photos/800/600';
        setTokensUsed(prev => Math.min(DAILY_TOKEN_LIMIT, prev + 2500));
      } else {
        const url = await service.generateVideo(
          prompt,
          config.model,
          config.ratio || '16:9'
        );
        resultUrl = url || 'https://picsum.photos/800/600'; 
        setTokensUsed(prev => Math.min(DAILY_TOKEN_LIMIT, prev + 5000));
      }

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
      const aistudio = (window as any).aistudio;
      if (err?.message?.includes("Requested entity was not found.") && aistudio) {
        await aistudio.openSelectKey();
      } else {
        alert('生成失败，请检查配置或API Key');
      }
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

  // Only show cases for specialized modes (Image/Video) on the landing page
  const landingCases = activeMode === AppMode.TEXT ? [] : CASES.filter(c => c.type === activeMode);

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
            {(activeMode === AppMode.TEXT || activeMode === AppMode.IMAGE) && (
              <button 
                onClick={() => switchMode(AppMode.IMAGE)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 border ${activeMode === AppMode.IMAGE ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm ring-1 ring-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
              >
                <ImageIcon size={12} />
                <span>图片生成</span>
                {activeMode === AppMode.IMAGE && <X size={10} className="ml-1 opacity-50" />}
              </button>
            )}
            {(activeMode === AppMode.TEXT || activeMode === AppMode.VIDEO) && (
              <button 
                onClick={() => switchMode(AppMode.VIDEO)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 border ${activeMode === AppMode.VIDEO ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm ring-1 ring-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
              >
                <VideoIcon size={12} />
                <span>视频生成</span>
                {activeMode === AppMode.VIDEO && <X size={10} className="ml-1 opacity-50" />}
              </button>
            )}
          </div>

          {activeMode === AppMode.TEXT && (
            <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer relative">
               <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files && setConfig({...config, attachments: Array.from(e.target.files)})} />
               <Paperclip size={12} className="mr-2 text-gray-400" />
               <span>附件 ({config.attachments?.length || 0})</span>
               {config.attachments && config.attachments.length > 0 && (
                 <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfig({...config, attachments: []}); }} className="ml-2 hover:text-red-500"><X size={10} /></button>
               )}
            </div>
          )}

          {(activeMode === AppMode.IMAGE || activeMode === AppMode.VIDEO) && (
            <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer relative group">
               <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files && setConfig({...config, refImage: e.target.files[0]})} />
               <ImageIcon size={12} className="mr-2 text-gray-400" />
               <span className="max-w-[100px] truncate">{config.refImage ? config.refImage.name : '参考图'}</span>
               {config.refImage && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfig({...config, refImage: null}); }} className="ml-2 hover:text-red-500"><X size={10} /></button>}
            </div>
          )}

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

          {activeMode === AppMode.VIDEO && (
            <div className="relative">
              <div onClick={() => toggleDropdown('duration')} className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer select-none">
                 <Timer size={12} className="mr-2 text-gray-400" />
                 <span>时长：{config.duration}</span>
              </div>
              {activeDropdown === 'duration' && (
                <div className="absolute bottom-full mb-2 left-0 w-32 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-bottom-2">
                  {VIDEO_DURATIONS.map(d => (
                    <button key={d} onClick={() => { setConfig({...config, duration: d}); setActiveDropdown(null); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 transition-colors ${config.duration === d ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>{d}</button>
                  ))}
                </div>
              )}
            </div>
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
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${!activeSessionId ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
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
                  className={`w-full text-left px-4 py-2.5 text-xs truncate rounded-lg transition-colors flex items-center space-x-2 ${activeSessionId === session.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
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
                <p className="text-xs font-semibold text-gray-800 truncate">游客用户</p>
                <p className="text-[10px] text-gray-400">点击登录同步数据</p>
              </div>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-white">
        <header className="h-16 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20">
          <div className="flex items-center space-x-2">
             <span className="text-sm font-bold text-gray-800">
               {activeMode === AppMode.TEXT ? '智能对话' : activeMode === AppMode.IMAGE ? '图片设计' : '视频生成'}
             </span>
             {activeSessionId && (
               <>
                 <ChevronRight size={14} className="text-gray-300" />
                 <span className="text-xs text-gray-400 truncate max-w-[200px]">{currentSession?.title}</span>
               </>
             )}
          </div>
          <div className="flex items-center space-x-3">
             <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><Search size={18} /></button>
             <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><Maximize2 size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-8 py-8 flex flex-col">
          <div className={`max-w-4xl mx-auto w-full flex flex-col space-y-8 ${!activeSessionId ? 'flex-1 justify-center items-center' : ''}`}>
            
            {!activeSessionId && !isGenerating && (
              <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                {renderInputArea()}

                {/* Cases under Input - Hidden in Text/Dialogue Mode Home */}
                {landingCases.length > 0 && (
                  <div className="mt-12 w-full grid gap-6 grid-cols-1 md:grid-cols-3">
                    {landingCases.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => useCase(item)}
                        className="group relative flex flex-col items-start bg-white rounded-3xl border border-gray-100 hover:border-blue-200 hover:shadow-2xl transition-all overflow-hidden text-left"
                      >
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
                          <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl group-hover:bg-blue-50 group-hover:scale-110 transition-transform">
                              {item.icon}
                            </div>
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
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI创意 响应</span>
                      </div>

                      {msg.resultUrl && (
                        <div className="rounded-2xl overflow-hidden shadow-sm bg-white group relative max-w-2xl">
                          {activeMode === AppMode.VIDEO ? (
                             <video src={msg.resultUrl} controls className="w-full max-h-[500px]" />
                          ) : (
                             <img src={msg.resultUrl} alt="Result" className="w-full max-h-[500px] object-contain" />
                          )}
                          <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors">
                                <Download size={16} className="text-gray-700" />
                             </button>
                             <button className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors">
                                <RefreshCw size={16} className="text-gray-700" />
                             </button>
                          </div>
                        </div>
                      )}

                      {msg.content && (
                        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      )}
                      
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
                    <span className="text-xs text-gray-500 font-medium">
                      {activeMode === AppMode.VIDEO ? "正在创作视频，这可能需要几分钟..." : "正在深度思考并创作中..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {activeSessionId && (
          <div className="p-4 sm:p-8 bg-gradient-to-t from-white via-white to-transparent sticky bottom-0 z-10" ref={dropdownRef}>
            <div className="max-w-4xl mx-auto">
              {renderInputArea()}
              <p className="text-center text-[10px] text-gray-400 mt-4 px-4">AI 生成内容仅供参考，请遵守当地法规和社区守则</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
