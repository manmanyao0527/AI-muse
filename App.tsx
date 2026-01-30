import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  ImageIcon, 
  VideoIcon, 
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
  ChevronDown, 
  LayoutDashboard, 
  Calendar, 
  Activity, 
  Users, 
  Box, 
  TrendingUp, 
  ChevronUp, 
  FileText, 
  Music, 
  FileSpreadsheet, 
  File,
  ArrowRight,
  Eye,
  Maximize,
  Clock,
  Monitor,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Check,
  AlertCircle
} from 'lucide-react';
import { AppMode, DialogueSession, Message, AppConfig, CaseItem, DateLog, UserDailyStat } from './types';
import { DAILY_TOKEN_LIMIT, MODELS, IMAGE_RATIOS, IMAGE_SIZES, VIDEO_RATIOS, VIDEO_DURATIONS, VIDEO_RESOLUTIONS, STYLES, CASES } from './constants';
import { AIService } from './services/geminiService';

// Utility to get file icons based on type/name
const getFileIconInternal = (type: string, name: string) => {
  if (type.startsWith('image/')) return <ImageIcon size={20} className="text-blue-500" />;
  if (type.includes('pdf')) return <FileText size={20} className="text-red-500" />;
  if (type.includes('audio') || type.includes('mp3')) return <Music size={20} className="text-purple-500" />;
  if (type.includes('excel') || type.includes('spreadsheet') || name.endsWith('.xls') || name.endsWith('.xlsx')) return <FileSpreadsheet size={20} className="text-green-500" />;
  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return <FileText size={20} className="text-blue-600" />;
  return <File size={20} className="text-gray-500" />;
};

// Component for file thumbnails in the input area
const AttachmentThumbnail: React.FC<{ file: File; onRemove: () => void; onClick: (file: File) => void }> = React.memo(({ file, onRemove, onClick }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <div 
      className="relative group w-16 h-16 sm:w-20 sm:h-20 shrink-0 animate-in fade-in zoom-in-95 duration-200 cursor-pointer"
      onClick={() => onClick(file)}
    >
      <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center shadow-sm">
        {previewUrl ? (
          <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center p-1">
            {getFileIconInternal(file.type, file.name)}
            <span className="text-[8px] text-gray-400 mt-1 truncate max-w-full px-1">{file.name}</span>
          </div>
        )}
      </div>
      <button 
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-md text-gray-400 hover:text-red-500 transition-colors z-10 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
      >
        <X size={12} />
      </button>
    </div>
  );
});

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
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  
  // For file preview lightbox
  const [previewContent, setPreviewContent] = useState<{ url: string; name: string; type: string } | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [expandedOverview, setExpandedOverview] = useState<Set<string>>(new Set());
  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(new Set());

  const [config, setConfig] = useState<AppConfig>({
    model: MODELS.text[0].value,
    modelLabel: MODELS.text[0].label,
    ratio: '9:16',
    imageSize: '1K',
    videoResolution: '480p',
    style: STYLES[0],
    duration: '3s',
    attachments: [],
    refImages: [],
    videoFirstFrame: null,
    videoLastFrame: null,
    refImage: null,
    refVideo: null
  });

  const [activeDropdown, setActiveDropdown] = useState<'ratio' | 'duration' | 'model' | 'size' | 'resolution' | 'frames' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImgInputRef = useRef<HTMLInputElement>(null);
  const videoFirstFrameRef = useRef<HTMLInputElement>(null);
  const videoLastFrameRef = useRef<HTMLInputElement>(null);

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
    
    let defaultModel;
    if (newMode === AppMode.TEXT) {
      defaultModel = MODELS.text[0]; 
    } else if (newMode === AppMode.IMAGE) {
      defaultModel = MODELS.image[0]; 
    } else {
      defaultModel = MODELS.video[0]; 
    }

    const defaultRatio = (newMode === AppMode.VIDEO || newMode === AppMode.IMAGE) ? '9:16' : '1:1';
    
    setConfig(prev => ({
      ...prev,
      model: defaultModel.value,
      modelLabel: defaultModel.label,
      ratio: defaultRatio,
      imageSize: '1K',
      videoResolution: '480p',
      duration: '3s',
      attachments: [],
      refImages: [],
      videoFirstFrame: null,
      videoLastFrame: null
    }));
    setActiveDropdown(null);
  };

  const startNewSession = () => {
    setActiveView('chat');
    setActiveSessionId(null);
    setActiveMode(AppMode.TEXT);
    setInputPrompt('');
    setConfig({
      model: MODELS.text[0].value,
      modelLabel: MODELS.text[0].label,
      ratio: '9:16',
      imageSize: '1K',
      videoResolution: '480p',
      style: STYLES[0],
      duration: '3s',
      attachments: [],
      refImages: [],
      videoFirstFrame: null,
      videoLastFrame: null,
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

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (overridePrompt?: string) => {
    const prompt = overridePrompt || inputPrompt;
    const currentAttachments = config.attachments || [];
    const currentRefImages = config.refImages || [];
    
    // Video mode mandatory check
    if (activeMode === AppMode.VIDEO && !config.videoFirstFrame && !overridePrompt) {
      showToast("图片未上传", "info");
      return;
    }

    if (!prompt.trim() && currentAttachments.length === 0 && currentRefImages.length === 0 && !config.videoFirstFrame && !config.videoLastFrame && !overridePrompt || isGenerating) return;

    const isVeoModel = config.model.includes('veo');
    const isProImageModel = config.model === 'gemini-3-pro-image-preview';

    if (isVeoModel || isProImageModel) {
      const aistudio = (window as any).aistudio;
      if (aistudio && !(await aistudio.hasSelectedApiKey())) {
        await aistudio.openSelectKey();
      }
    }

    const msgAttachments = [
      ...currentAttachments.map(f => ({
        name: f.name,
        type: f.type,
        url: URL.createObjectURL(f)
      })),
      ...currentRefImages.map(f => ({
        name: `参考图: ${f.name}`,
        type: f.type,
        url: URL.createObjectURL(f)
      }))
    ];

    if (config.videoFirstFrame) {
      msgAttachments.push({
        name: `首帧: ${config.videoFirstFrame.name}`,
        type: config.videoFirstFrame.type,
        url: URL.createObjectURL(config.videoFirstFrame)
      });
    }

    if (config.videoLastFrame) {
      msgAttachments.push({
        name: `尾帧: ${config.videoLastFrame.name}`,
        type: config.videoLastFrame.type,
        url: URL.createObjectURL(config.videoLastFrame)
      });
    }

    setInputPrompt('');
    setConfig(prev => ({ ...prev, attachments: [], refImages: [], videoFirstFrame: null, videoLastFrame: null })); 
    setIsGenerating(true);
    
    let sessionId = activeSessionId;
    let updatedSessions = [...sessions];
    
    if (!sessionId) {
      sessionId = Date.now().toString();
      const newSession: DialogueSession = {
        id: sessionId,
        mode: activeMode,
        title: prompt.slice(0, 30) || '对话 ' + new Date().toLocaleTimeString(),
        messages: [],
        params: { ...config, attachments: [], refImages: [], videoFirstFrame: null, videoLastFrame: null },
        timestamp: Date.now()
      };
      updatedSessions = [newSession, ...updatedSessions];
      setActiveSessionId(sessionId);
    }

    const sessionIndex = updatedSessions.findIndex(s => s.id === sessionId);
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: prompt, 
      attachments: msgAttachments,
      timestamp: Date.now() 
    };
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
        const url = await service.generateImage(prompt, config.model, config.ratio || '9:16', lastResultUrl || undefined);
        resultUrl = url || 'https://picsum.photos/800/1422';
        pointCost = 2500;
      } else {
        const url = await service.generateVideo(
          prompt, 
          config.model, 
          config.ratio || '9:16', 
          config.videoResolution || '480p',
          config.videoFirstFrame,
          config.videoLastFrame
        );
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
        timestamp: Date.now(),
        ratio: (activeMode === AppMode.IMAGE || activeMode === AppMode.VIDEO) ? config.ratio : undefined
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

  const toggleDropdown = (dropdown: 'ratio' | 'duration' | 'model' | 'size' | 'resolution' | 'frames') => {
    setActiveDropdown(prev => prev === dropdown ? null : dropdown);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'attachments' | 'refImages' | 'videoFirstFrame' | 'videoLastFrame') => {
    if (e.target.files && e.target.files[0]) {
      if (field === 'videoFirstFrame' || field === 'videoLastFrame') {
        setConfig(prev => ({ ...prev, [field]: e.target.files![0] }));
        return;
      }

      const current = config[field] as File[] || [];
      const newFiles = Array.from(e.target.files);
      
      if (current.length + newFiles.length > 10) {
        alert('最多支持上传 10 个文件');
        const allowedNewCount = 10 - current.length;
        if (allowedNewCount > 0) {
          setConfig(prev => ({
            ...prev,
            [field]: [...(prev[field] as File[] || []), ...newFiles.slice(0, allowedNewCount)]
          }));
        }
      } else {
        setConfig(prev => ({
          ...prev,
          [field]: [...(prev[field] as File[] || []), ...newFiles]
        }));
      }
    }
  };

  const removeFile = (index: number, field: 'attachments' | 'refImages' | 'videoFirstFrame' | 'videoLastFrame') => {
    if (field === 'videoFirstFrame' || field === 'videoLastFrame') {
       setConfig(prev => ({ ...prev, [field]: null }));
       return;
    }
    setConfig(prev => ({
      ...prev,
      [field]: (prev[field] as File[] || []).filter((_, i) => i !== index)
    }));
  };

  const downloadFile = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${name} 下载成功`);
  };

  const handleAttachmentClick = (att: { name: string; type: string; url?: string }) => {
    if (att.url) {
      setPreviewContent({ url: att.url, name: att.name, type: att.type });
    }
  };

  const handleThumbnailClick = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewContent({ url, name: file.name, type: file.type });
  };

  const handleCopyText = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus(msgId);
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  const handleFeedback = (msgId: string, type: 'like' | 'dislike') => {
    setSessions(prevSessions => {
      const newSessions = [...prevSessions];
      const sessionIndex = newSessions.findIndex(s => s.id === activeSessionId);
      if (sessionIndex === -1) return prevSessions;

      const session = { ...newSessions[sessionIndex] };
      const msgIndex = session.messages.findIndex(m => m.id === msgId);
      if (msgIndex === -1) return prevSessions;

      const msg = { ...session.messages[msgIndex] };
      
      // Toggle feedback
      if (msg.feedback === type) {
        msg.feedback = null;
      } else {
        msg.feedback = type;
        // If switching, the other type is automatically unset because feedback is a single property 'like' | 'dislike' | null
      }

      session.messages = [...session.messages];
      session.messages[msgIndex] = msg;
      newSessions[sessionIndex] = session;
      
      localStorage.setItem('ai_creative_sessions', JSON.stringify(newSessions));
      return newSessions;
    });
  };

  const landingCases = activeMode === AppMode.TEXT ? [] : CASES.filter(c => c.type === activeMode);

  const getModuleLabels = (mode: AppMode) => {
    const mapping = {
      [AppMode.TEXT]: '智能对话',
      [AppMode.IMAGE]: '图片生成',
      [AppMode.VIDEO]: '视频生成'
    };
    return { level1: 'AI小禹', level2: mapping[mode] || mode };
  };

  const renderInputArea = () => (
    <div ref={dropdownRef} className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 p-2 transform transition-all hover:shadow-[0_25px_60px_rgba(0,0,0,0.12)] focus-within:ring-2 focus-within:ring-blue-100 relative w-full">
      <div className="flex flex-col">
        {/* File Preview Area */}
        {(config.attachments?.length || 0) + (config.refImages?.length || 0) + (config.videoFirstFrame ? 1 : 0) + (config.videoLastFrame ? 1 : 0) > 0 && (
          <div className="px-4 pt-4 pb-2 animate-in slide-in-from-top-2 duration-300">
            <div className="flex flex-wrap items-center gap-3">
              {(config.attachments || []).map((file, idx) => (
                <AttachmentThumbnail 
                  key={`att-${idx}`} 
                  file={file} 
                  onRemove={() => removeFile(idx, 'attachments')} 
                  onClick={handleThumbnailClick}
                />
              ))}
              {(config.refImages || []).map((file, idx) => (
                <div key={`ref-${idx}`} className="relative">
                  <AttachmentThumbnail 
                    file={file} 
                    onRemove={() => removeFile(idx, 'refImages')} 
                    onClick={handleThumbnailClick}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-600/80 text-[8px] text-white text-center rounded-b-2xl font-bold py-0.5">参考图</div>
                </div>
              ))}
              {config.videoFirstFrame && (
                <div className="relative">
                  <AttachmentThumbnail 
                    file={config.videoFirstFrame} 
                    onRemove={() => removeFile(0, 'videoFirstFrame')} 
                    onClick={handleThumbnailClick}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-[8px] text-white text-center rounded-b-2xl font-bold py-0.5">首帧</div>
                </div>
              )}
              {config.videoLastFrame && (
                <div className="relative">
                  <AttachmentThumbnail 
                    file={config.videoLastFrame} 
                    onRemove={() => removeFile(0, 'videoLastFrame')} 
                    onClick={handleThumbnailClick}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-purple-600/80 text-[8px] text-white text-center rounded-b-2xl font-bold py-0.5">尾帧</div>
                </div>
              )}
            </div>
          </div>
        )}

        <textarea 
          ref={inputRef}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onFocus={() => setActiveDropdown(null)}
          onClick={() => setActiveDropdown(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={activeMode === AppMode.TEXT ? "发消息或输入“/”选择技能" : (activeMode === AppMode.IMAGE ? "描述图片设计方案..." : "上传图片，描述你想生成的视频")}
          className="w-full h-24 resize-none text-base sm:text-lg text-gray-700 placeholder-gray-300 bg-transparent px-4 pt-4 focus:outline-none custom-scrollbar"
        />
        
        <div 
          className="flex flex-wrap items-center gap-2 px-4 pb-3 min-h-12 h-auto cursor-default"
          onClick={() => setActiveDropdown(null)}
        >
          {/* Mode Switches */}
          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
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

            {/* Attachment Button - Smart Dialogue */}
            {activeMode === AppMode.TEXT && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => handleFileChange(e, 'attachments')} 
                  className="hidden" 
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.mp3,audio/*,image/*"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 border ${config.attachments?.length ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-white hover:border-blue-200 hover:text-blue-600'}`}
                >
                  <Paperclip size={12} />
                  <span>附件{config.attachments?.length ? ` (${config.attachments.length})` : ''}</span>
                </button>
              </>
            )}

            {/* Reference Image Button - Image Mode */}
            {activeMode === AppMode.IMAGE && (
              <>
                <input 
                  type="file" 
                  ref={refImgInputRef} 
                  onChange={(e) => handleFileChange(e, 'refImages')} 
                  className="hidden" 
                  multiple
                  accept="image/*"
                />
                <button 
                  onClick={() => refImgInputRef.current?.click()}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 border ${config.refImages?.length ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-white hover:border-blue-200 hover:text-blue-600'}`}
                >
                  <ImageIcon size={12} />
                  <span>参考图{config.refImages?.length ? ` (${config.refImages.length})` : ''}</span>
                </button>
              </>
            )}

            {/* Merged Video Reference Frames Entry - Video Mode */}
            {activeMode === AppMode.VIDEO && (
               <div className="relative">
                 <input type="file" ref={videoFirstFrameRef} onChange={(e) => handleFileChange(e, 'videoFirstFrame')} className="hidden" accept="image/*" />
                 <input type="file" ref={videoLastFrameRef} onChange={(e) => handleFileChange(e, 'videoLastFrame')} className="hidden" accept="image/*" />
                 <button 
                   onClick={() => toggleDropdown('frames')}
                   className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 border ${config.videoFirstFrame ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-white hover:border-indigo-200 hover:text-indigo-600'}`}
                 >
                   <ImageIcon size={12} />
                   <span>首尾帧</span>
                 </button>
                 {activeDropdown === 'frames' && (
                    <div className="absolute bottom-full mb-2 left-0 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in slide-in-from-bottom-2">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">上传视频帧</p>
                       <div className="flex space-x-3">
                          <div 
                            onClick={() => videoFirstFrameRef.current?.click()}
                            className={`flex-1 aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden ${config.videoFirstFrame ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                          >
                             {config.videoFirstFrame ? (
                               <img src={URL.createObjectURL(config.videoFirstFrame)} className="w-full h-full object-cover" />
                             ) : (
                               <div className="text-center px-1">
                                 <Plus size={14} className="mx-auto text-gray-400 mb-1" />
                                 <span className="text-[9px] text-gray-500 font-bold">首帧(必)</span>
                               </div>
                             )}
                          </div>
                          <div 
                            onClick={() => videoLastFrameRef.current?.click()}
                            className={`flex-1 aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden ${config.videoLastFrame ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                          >
                             {config.videoLastFrame ? (
                               <img src={URL.createObjectURL(config.videoLastFrame)} className="w-full h-full object-cover" />
                             ) : (
                               <div className="text-center px-1">
                                 <Plus size={14} className="mx-auto text-gray-400 mb-1" />
                                 <span className="text-[9px] text-gray-500 font-bold">尾帧(选)</span>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                 )}
               </div>
            )}
          </div>

          {/* Configuration controls for Image/Video */}
          {(activeMode === AppMode.IMAGE || activeMode === AppMode.VIDEO) && (
            <div className="flex items-center space-x-1 animate-in fade-in duration-300 flex-wrap gap-y-2" onClick={(e) => e.stopPropagation()}>
              {/* Ratio Selection */}
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

              {/* Size Configuration for Image Mode */}
              {activeMode === AppMode.IMAGE && (
                <div className="relative">
                  <div onClick={() => toggleDropdown('size')} className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer select-none">
                     <Maximize size={12} className="mr-2 text-gray-400" />
                     <span>尺寸：{config.imageSize || '1K'}</span>
                  </div>
                  {activeDropdown === 'size' && (
                    <div className="absolute bottom-full mb-2 left-0 w-32 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-bottom-2">
                      {IMAGE_SIZES.map(s => (
                        <button key={s} onClick={() => { setConfig({...config, imageSize: s}); setActiveDropdown(null); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 transition-colors ${config.imageSize === s ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Duration for Video Mode */}
              {activeMode === AppMode.VIDEO && (
                <div className="relative">
                  <div onClick={() => toggleDropdown('duration')} className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer select-none">
                     <Clock size={12} className="mr-2 text-gray-400" />
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

              {/* Resolution Configuration for Video Mode */}
              {activeMode === AppMode.VIDEO && (
                <div className="relative">
                  <div onClick={() => toggleDropdown('resolution')} className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer select-none">
                     <Monitor size={12} className="mr-2 text-gray-400" />
                     <span>分辨率：{config.videoResolution || '480p'}</span>
                  </div>
                  {activeDropdown === 'resolution' && (
                    <div className="absolute bottom-full mb-2 left-0 w-32 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-bottom-2">
                      {VIDEO_RESOLUTIONS.map(res => (
                        <button key={res} onClick={() => { setConfig({...config, videoResolution: res}); setActiveDropdown(null); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 transition-colors ${config.videoResolution === res ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>{res}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Model Selection */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <div 
              onClick={() => toggleDropdown('model')}
              className="flex items-center bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-500 border border-gray-100 hover:bg-white hover:border-blue-200 transition-all cursor-pointer select-none"
            >
               <Settings2 size={12} className="mr-2 text-gray-400" />
               <span className="max-w-[120px] truncate">{config.modelLabel || config.model}</span>
               <ChevronDown size={12} className={`ml-1 text-gray-400 transition-transform ${activeDropdown === 'model' ? 'rotate-180' : ''}`} />
            </div>
            {activeDropdown === 'model' && (
              <div className="absolute bottom-full mb-2 left-0 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-bottom-2">
                {MODELS[activeMode === AppMode.TEXT ? 'text' : (activeMode === AppMode.IMAGE ? 'image' : 'video')].map(m => (
                  <button 
                    key={m.label + m.value}
                    onClick={() => { setConfig({...config, model: m.value, modelLabel: m.label}); setActiveDropdown(null); }}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 transition-colors ${config.modelLabel === m.label ? 'text-blue-600 font-bold' : 'text-gray-600'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send button */}
          <div className="ml-auto flex items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => handleSubmit()}
              disabled={!inputPrompt.trim() && (!config.attachments || config.attachments.length === 0) && (!config.refImages || config.refImages.length === 0) && !config.videoFirstFrame && !config.videoLastFrame || isGenerating}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${ (inputPrompt.trim() || (config.attachments && config.attachments.length > 0) || (config.refImages && config.refImages.length > 0) || config.videoFirstFrame || config.videoLastFrame) && !isGenerating ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 scale-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed scale-95'}`}
            >
              {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const toggleExpandOverview = (date: string) => {
    setExpandedOverview(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleExpandAudit = (id: string) => {
    setExpandedAudit(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderLogsView = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDate = now.getDate();

    let lastDayToShow: number;
    if (year === currentYear && month === currentMonth) {
      lastDayToShow = currentDate;
    } else {
      lastDayToShow = new Date(year, month, 0).getDate();
    }

    const allDates: string[] = [];
    for (let d = lastDayToShow; d >= 1; d--) {
      allDates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }

    const filteredLogs = logs.filter(l => l.date.startsWith(selectedMonth));
    const userActiveDays: { [uid: string]: Set<string> } = {};
    const monthUniqueUsers = new Set<string>();
    let totalPv = 0;
    let totalPoints = 0;

    filteredLogs.forEach(log => {
      Object.entries(log.users).forEach(([uId, modes]) => {
        monthUniqueUsers.add(uId);
        if (!userActiveDays[uId]) userActiveDays[uId] = new Set();
        Object.values(modes as UserDailyStat).forEach(stat => {
          totalPv += stat.pv;
          totalPoints += stat.points;
          if (stat.pv > 0 || stat.points > 0) {
            userActiveDays[uId].add(log.date);
          }
        });
      });
    });

    const mauCount = Object.keys(userActiveDays).filter(uId => userActiveDays[uId].size > 9).length;

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
            <div><p className="text-xs font-bold blue-600 uppercase tracking-wider">月活 (MAU)</p><p className="text-2xl font-bold text-gray-800">{mauCount}</p><p className="text-[9px] text-gray-400 mt-1">月活跃天数>9</p></div>
          </div>
        </div>

        {activeLogTab === 'overview' ? (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center space-x-2"><Box size={18} className="text-blue-500" /><span>功能模块流水概览</span></h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-8 py-4 w-40">日期</th>
                    <th className="px-8 py-4">路径</th>
                    <th className="px-8 py-4">PV</th>
                    <th className="px-8 py-4">UV</th>
                    <th className="px-8 py-4">点数消耗</th>
                    <th className="px-8 py-4 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allDates.map((date) => {
                    const dayLog = filteredLogs.find(l => l.date === date);
                    const modes = [AppMode.TEXT, AppMode.IMAGE, AppMode.VIDEO];
                    
                    let dayTotalPv = 0;
                    let dayTotalPoints = 0;
                    const dayUvSet = new Set();
                    
                    const modeStats = modes.map(mode => {
                      let pv = 0, points = 0, uvCount = 0;
                      if (dayLog) {
                        const modeUvSet = new Set();
                        Object.entries(dayLog.users).forEach(([uid, mStats]) => {
                          const stat = mStats[mode];
                          if (stat && (stat.pv > 0 || stat.points > 0)) {
                            pv += stat.pv;
                            points += stat.points;
                            modeUvSet.add(uid);
                            dayUvSet.add(uid);
                          }
                        });
                        uvCount = modeUvSet.size;
                      }
                      dayTotalPv += pv;
                      dayTotalPoints += points;
                      return { mode, pv, points, uvCount };
                    });

                    const isExpanded = expandedOverview.has(date);
                    const hasActivity = dayTotalPv > 0;

                    return (
                      <React.Fragment key={date}>
                        <tr 
                          className={`group transition-colors ${hasActivity ? 'hover:bg-gray-50/80 cursor-pointer' : 'opacity-50'}`}
                          onClick={() => hasActivity && toggleExpandOverview(date)}
                        >
                          <td className="px-8 py-5 text-xs font-medium text-gray-500">{date}</td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-800">AI小禹</span>
                              <span className="text-[9px] text-gray-400 font-bold uppercase">PRIMARY MODULE</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-xs font-bold text-gray-800">{dayTotalPv || '-'}</td>
                          <td className="px-8 py-5 text-xs font-bold text-gray-800">{dayUvSet.size || '-'}</td>
                          <td className={`px-8 py-5 text-xs font-bold ${dayTotalPoints > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{dayTotalPoints > 0 ? dayTotalPoints.toLocaleString() : '-'}</td>
                          <td className="px-8 py-5 text-center">
                            {hasActivity && (
                              isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && modeStats.map((ms, idx) => (
                          <tr key={`${date}-${ms.mode}`} className="bg-blue-50/20 border-l-4 border-l-blue-500/30">
                            <td className="px-8 py-3"></td>
                            <td className="px-8 py-3">
                              <div className="flex items-center space-x-2 pl-4">
                                <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                                <span className="text-xs font-medium text-gray-600">{getModuleLabels(ms.mode).level2}</span>
                              </div>
                            </td>
                            <td className="px-8 py-3 text-xs text-gray-500">{ms.pv || '-'}</td>
                            <td className="px-8 py-3 text-xs text-gray-500">{ms.uvCount || '-'}</td>
                            <td className="px-8 py-3 text-xs text-gray-400 font-medium">{ms.points > 0 ? ms.points.toLocaleString() : '-'}</td>
                            <td></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center space-x-2"><Users size={18} className="text-indigo-500" /><span>用户审计明细</span></h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-8 py-4 w-40">日期</th>
                    <th className="px-8 py-4">用户名</th>
                    <th className="px-8 py-4">总 PV</th>
                    <th className="px-8 py-4">总消耗</th>
                    <th className="px-8 py-4 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allDates.map((date) => {
                    const dayLog = filteredLogs.find(l => l.date === date);
                    const dayUsers = dayLog ? Object.entries(dayLog.users) : [];

                    if (dayUsers.length === 0) {
                      return (
                        <tr key={date} className="opacity-40">
                          <td className="px-8 py-5 text-xs font-medium text-gray-500">{date}</td>
                          <td colSpan={4} className="px-8 py-5 text-xs text-gray-300 italic">当日无活跃记录</td>
                        </tr>
                      );
                    }

                    return dayUsers.map(([uId, modes]) => {
                      const expandKey = `${date}-${uId}`;
                      const isExpanded = expandedAudit.has(expandKey);
                      
                      let userDayPv = 0;
                      let userDayPoints = 0;
                      const userModeLogs = Object.entries(modes as UserDailyStat).filter(([_, s]) => s.pv > 0 || s.points > 0).map(([m, s]) => {
                        userDayPv += s.pv;
                        userDayPoints += s.points;
                        return { mode: m as AppMode, pv: s.pv, points: s.points };
                      });

                      return (
                        <React.Fragment key={expandKey}>
                          <tr 
                            className="group hover:bg-gray-50/80 transition-colors cursor-pointer"
                            onClick={() => toggleExpandAudit(expandKey)}
                          >
                            <td className="px-8 py-5 text-xs font-medium text-gray-500">{date}</td>
                            <td className="px-8 py-5">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{uId.charAt(0)}</div>
                                <span className="text-xs font-bold text-gray-800">{uId}</span>
                                {userActiveDays[uId]?.size > 9 && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-bold">MAU</span>}
                              </div>
                            </td>
                            <td className="px-8 py-5 text-xs text-gray-600 font-bold">{userDayPv}</td>
                            <td className="px-8 py-5 text-xs text-blue-600 font-bold">{userDayPoints.toLocaleString()}</td>
                            <td className="px-8 py-5 text-center">
                              {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </td>
                          </tr>
                          {isExpanded && userModeLogs.map((log) => (
                            <tr key={`${expandKey}-${log.mode}`} className="bg-indigo-50/20 border-l-4 border-l-indigo-500/30">
                              <td className="px-8 py-3"></td>
                              <td className="px-8 py-3">
                                <div className="flex items-center space-x-2">
                                  <div className="w-1 h-1 rounded-full bg-indigo-400"></div>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">AI小禹</span>
                                  <ChevronRight size={10} className="text-gray-300" />
                                  <span className="text-[10px] font-bold uppercase text-gray-600">{getModuleLabels(log.mode).level2}</span>
                                </div>
                              </td>
                              <td className="px-8 py-3 text-[10px] text-gray-500">{log.pv}</td>
                              <td className="px-8 py-3 text-[10px] text-indigo-400 font-bold">{log.points.toLocaleString()}</td>
                              <td></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    });
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
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] flex items-center space-x-3 bg-white px-6 py-3 rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
           <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
              {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
           </div>
           <span className="text-sm font-bold text-gray-800">{toast.message}</span>
        </div>
      )}

      {/* Enhanced Lightbox Modal */}
      {previewContent && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 animate-in fade-in duration-300 backdrop-blur-md"
          onClick={() => setPreviewContent(null)}
        >
          <div className="absolute top-6 right-6 flex items-center space-x-4" onClick={(e) => e.stopPropagation()}>
             <button 
               onClick={() => downloadFile(previewContent.url, previewContent.name)}
               className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors flex items-center space-x-2"
               title="下载到本地"
             >
               <Download size={20} />
               <span className="text-sm font-medium">下载</span>
             </button>
             <button 
               onClick={() => setPreviewContent(null)}
               className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
               title="关闭预览"
             >
               <X size={20} />
             </button>
          </div>
          
          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white/5 p-2 rounded-3xl backdrop-blur-sm border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                {previewContent.type.startsWith('image/') ? (
                  <img 
                    src={previewContent.url} 
                    alt={previewContent.name} 
                    className="max-w-full max-h-[70vh] object-contain rounded-2xl"
                  />
                ) : previewContent.type.startsWith('video/') ? (
                  <video 
                    src={previewContent.url} 
                    controls 
                    autoPlay
                    className="max-w-full max-h-[70vh] rounded-2xl"
                  />
                ) : (
                  <div className="w-80 h-80 flex flex-col items-center justify-center bg-white rounded-2xl text-center p-8">
                     <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-6">
                        {getFileIconInternal(previewContent.type, previewContent.name)}
                     </div>
                     <p className="font-bold text-gray-800 mb-2 truncate w-full">{previewContent.name}</p>
                     <p className="text-xs text-gray-400 mb-8 uppercase font-bold tracking-widest">{previewContent.type}</p>
                     <button 
                        onClick={() => downloadFile(previewContent.url, previewContent.name)}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                     >
                        <Download size={18} />
                        <span>立即下载</span>
                     </button>
                  </div>
                )}
            </div>
            <div className="mt-6 flex flex-col items-center">
                <p className="text-white font-bold text-lg">{previewContent.name}</p>
                <div className="mt-2 flex items-center space-x-2 text-white/40 text-xs font-medium uppercase tracking-widest">
                   <span>{previewContent.type}</span>
                   <div className="w-1 h-1 rounded-full bg-white/20"></div>
                   <span>点击背景区域可关闭窗口</span>
                </div>
            </div>
          </div>
        </div>
      )}

      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">AI小禹</h1>
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
            <div className={`max-w-4xl mx-auto w-full flex flex-col ${!activeSessionId ? 'flex-1 pt-[20vh]' : 'space-y-8'}`}>
              {!activeSessionId && !isGenerating && (
                <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-full mb-12">
                    {renderInputArea()}
                  </div>
                  {landingCases.length > 0 && (
                    <div className="w-full grid gap-6 grid-cols-1 md:grid-cols-3 animate-in fade-in slide-in-from-top-4 duration-700 delay-200">
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
                <div key={msg.id} className="flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 mb-8">
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end space-y-2">
                      <div className="max-w-[80%] bg-blue-600 text-white rounded-3xl rounded-tr-sm px-6 py-4 shadow-lg shadow-blue-500/20">
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                      {/* Attachments displayed in chat box */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-2 max-w-[80%]">
                          {msg.attachments.map((att, idx) => (
                            <div 
                              key={idx} 
                              className="relative group w-16 h-16 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-gray-100 bg-white flex items-center justify-center shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => handleAttachmentClick(att)}
                            >
                              {att.url && att.type.startsWith('image/') ? (
                                <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-1 w-full h-full">
                                  {getFileIconInternal(att.type, att.name)}
                                  <span className="text-[8px] sm:text-[10px] text-gray-500 mt-2 truncate w-full px-2 text-center font-medium">{att.name}</span>
                                </div>
                              )}
                              
                              {/* Hover Overlay Actions */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                                 {att.url && (
                                   <>
                                     <button 
                                       onClick={(e) => { e.stopPropagation(); handleAttachmentClick(att); }}
                                       className="p-1.5 bg-white rounded-full text-blue-600 shadow-sm hover:scale-110 transition-transform"
                                       title="预览"
                                     >
                                       <Eye size={14} />
                                     </button>
                                     <button 
                                       onClick={(e) => { e.stopPropagation(); downloadFile(att.url!, att.name); }}
                                       className="p-1.5 bg-white rounded-full text-gray-700 shadow-sm hover:scale-110 transition-transform"
                                       title="下载"
                                     >
                                       <Download size={14} />
                                     </button>
                                   </>
                                 )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[90%] bg-gray-50 border border-gray-100 rounded-3xl rounded-tl-sm p-6 space-y-4 w-full group/msg relative">
                        <div className="flex items-center space-x-2 mb-2">
                           <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                              <Sparkles size={12} className="text-blue-600" />
                           </div>
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI 响应</span>
                        </div>
                        
                        {msg.resultUrl && (
                          <div className={`rounded-2xl overflow-hidden shadow-sm bg-white group/result relative transition-all ${msg.ratio && (msg.ratio === '9:16' || msg.ratio === '3:4') ? 'max-w-[320px]' : (msg.ratio === '1:1' ? 'max-w-[400px]' : 'max-w-2xl')}`}>
                            {msg.ratio ? (
                              <div style={{ aspectRatio: msg.ratio.replace(':', '/') }} className="w-full bg-gray-100">
                                {activeMode === AppMode.VIDEO ? (
                                  <video src={msg.resultUrl} controls className="w-full h-full object-cover" />
                                ) : (
                                  <img src={msg.resultUrl} alt="Result" className="w-full h-full object-cover" />
                                )}
                              </div>
                            ) : (
                               activeMode === AppMode.VIDEO ? <video src={msg.resultUrl} controls className="w-full max-h-[500px]" /> : <img src={msg.resultUrl} alt="Result" className="w-full max-h-[500px] object-contain" />
                            )}
                            
                            {/* Result Hover Actions */}
                            <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover/result:opacity-100 transition-opacity z-10">
                               <button 
                                 onClick={() => {
                                    if (msg.resultUrl) {
                                      setPreviewContent({ 
                                        url: msg.resultUrl, 
                                        name: activeMode === AppMode.VIDEO ? '生成视频' : '生成图片', 
                                        type: activeMode === AppMode.VIDEO ? 'video/mp4' : 'image/png' 
                                      });
                                    }
                                 }}
                                 className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors"
                                 title="预览"
                               >
                                 <Eye size={16} className="text-gray-700" />
                               </button>
                               <button 
                                 onClick={() => downloadFile(msg.resultUrl!, `result-${Date.now()}.${activeMode === AppMode.VIDEO ? 'mp4' : 'png'}`)}
                                 className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors"
                                 title="下载到本地"
                               >
                                 <Download size={16} className="text-gray-700" />
                               </button>
                               <button 
                                 onClick={() => handleSubmit(msg.content)}
                                 className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors"
                                 title="重新生成"
                               >
                                 <RefreshCw size={16} className="text-gray-700" />
                               </button>
                            </div>
                          </div>
                        )}
                        
                        {msg.content && <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.content}</div>}
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                           <div className="flex items-center space-x-1">
                             <button 
                                onClick={() => handleCopyText(msg.content || '', msg.id)}
                                className={`p-1.5 rounded-lg transition-colors hover:bg-gray-200 text-gray-500 flex items-center space-x-1`}
                                title="复制内容"
                             >
                               {copyStatus === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                               {copyStatus === msg.id && <span className="text-[10px] font-bold text-green-500">已复制</span>}
                             </button>
                             <button 
                                onClick={() => {
                                  // Find the last user prompt in this session
                                  const lastUserMsg = currentSession?.messages.filter(m => m.role === 'user').pop();
                                  if (lastUserMsg) handleSubmit(lastUserMsg.content);
                                }}
                                className="p-1.5 rounded-lg transition-colors hover:bg-gray-200 text-gray-500"
                                title="重新生成结果"
                             >
                               <RefreshCw size={14} />
                             </button>
                             <div className="w-px h-3 bg-gray-200 mx-1"></div>
                             <button 
                               onClick={() => handleFeedback(msg.id, 'like')} 
                               className={`p-1.5 rounded-lg transition-colors ${msg.feedback === 'like' ? 'text-blue-500 bg-blue-50' : 'hover:text-gray-600 hover:bg-gray-100 text-gray-500'}`} 
                               title="喜欢"
                             >
                               <ThumbsUp size={14} />
                             </button>
                             <button 
                               onClick={() => handleFeedback(msg.id, 'dislike')} 
                               className={`p-1.5 rounded-lg transition-colors ${msg.feedback === 'dislike' ? 'text-red-500 bg-red-50' : 'hover:text-gray-600 hover:bg-gray-100 text-gray-500'}`} 
                               title="不喜欢"
                             >
                               <ThumbsDown size={14} />
                             </button>
                           </div>
                           <div className="flex items-center space-x-4">
                             <button className="text-[10px] font-bold text-gray-400 hover:text-gray-600">已保存</button>
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
          <div className="p-4 sm:p-8 bg-gradient-to-t from-white via-white to-transparent sticky bottom-0 z-10">
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