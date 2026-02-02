
import { AppMode, CaseItem } from './types';

export const DAILY_TOKEN_LIMIT = 50000;

export interface ModelOption {
  label: string;
  value: string;
}

export const MODELS: Record<string, ModelOption[]> = {
  text: [
    { label: '豆包', value: 'gemini-3-flash-preview' },
    { label: 'Gemini 3 Flash Preview', value: 'gemini-3-flash-preview' },
    { label: 'Gemini 3 pro Preview', value: 'gemini-3-pro-preview' }
  ],
  image: [
    { label: '豆包', value: 'gemini-2.5-flash-image' },
    { label: 'Nano Banana', value: 'gemini-2.5-flash-image' }
  ],
  video: [
    { label: 'seedance 1.0 Pro', value: 'veo-3.1-fast-generate-preview' },
    { label: 'seedance 1.5 Pro', value: 'veo-3.1-generate-preview' }
  ]
};

export const IMAGE_RATIOS = ['9:16', '16:9', '4:3', '3:4', '1:1', '21:9'];
export const IMAGE_SIZES = ['1K', '2K', '3K'];
export const VIDEO_RATIOS = ['9:16', '16:9', '4:3', '3:4', '1:1', '21:9'];
export const VIDEO_DURATIONS = ['3s', '5s'];
export const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'];
export const RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
export const STYLES = ['自然', '写实', '插画', '3D渲染', '赛博朋克', '中国风'];

export const CASES: CaseItem[] = [
  // Text Cases
  { 
    id: 't1', 
    type: AppMode.TEXT, 
    title: '写脚本', 
    description: '快速生成带分镜的带货视频脚本', 
    prompt: '帮我写一个推广新款无线耳机的短视频脚本，包含3个核心卖点。', 
    icon: '📝' 
  },
  { 
    id: 't2', 
    type: AppMode.TEXT, 
    title: '拆视频', 
    description: '智能提取视频文案并分析结构', 
    prompt: '请分析下面这段视频的文案结构和卖点：[粘贴文案]', 
    icon: '📽️' 
  },
  
  // Image Cases
  { 
    id: 'i1', 
    type: AppMode.IMAGE, 
    title: '一键换背景', 
    description: '智能识别主体并替换高质背景', 
    prompt: '将图片中的产品放在高端大理石台面上，背景光影柔和。', 
    icon: '🖼️',
    previewUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop'
  },
  { 
    id: 'i2', 
    type: AppMode.IMAGE, 
    title: '商品海报', 
    description: '全自动生成电商营销海报', 
    prompt: '设计一张双十一促销海报，主体是运动鞋，风格极简现代。', 
    icon: '🎨',
    previewUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800&auto=format&fit=crop'
  },
  { 
    id: 'i3', 
    type: AppMode.IMAGE, 
    title: '电商主图', 
    description: '制作高点击率的商品主图', 
    prompt: '制作一张化妆品主图，强调天然成分，左侧留白写字。', 
    icon: '🛒',
    previewUrl: 'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=800&auto=format&fit=crop'
  },

  // Video Cases
  { 
    id: 'v1', 
    type: AppMode.VIDEO, 
    title: '商品展示', 
    description: '赋予商品动态感，提升吸引力', 
    prompt: '让商品瓶身缓缓旋转，周围有水花溅起的动态效果。', 
    icon: '✨',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-perfume-bottle-on-a-rotating-platform-34444-large.mp4'
  },
  { 
    id: 'v2', 
    type: AppMode.VIDEO, 
    title: '图生视频', 
    description: '静态图一键转化为电影感短片', 
    prompt: '基于这张静态图片，生成一段航拍视高的动态视频。', 
    icon: '🎞️',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-clouds-and-blue-sky-background-2422-large.mp4'
  }
];
