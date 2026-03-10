import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Settings, 
  Upload, 
  Key, 
  Languages, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Plus,
  Trash2,
  ChevronRight,
  FileText,
  Copy,
  Download,
  Library,
  Edit2,
  Eye,
  X,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { 
  TranslationStatus, 
  ApiKey, 
  Chapter, 
  TranslationConfig, 
  AVAILABLE_MODELS 
} from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Auth } from './components/Auth';
import { User } from '@supabase/supabase-js';

export default function App() {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [novels, setNovels] = useState<{id: string, name: string}[]>([]);
  const [novelId, setNovelId] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [editingNovelId, setEditingNovelId] = useState<string | null>(null);
  const [editingNovelName, setEditingNovelName] = useState("");
  const [config, setConfig] = useState<TranslationConfig>({
    prompt: "Translate the following novel chapter into accurate and literary Arabic. Maintain the original tone, style, and cultural nuances. Ensure the flow is natural for Arabic readers.",
    targetLanguage: "Arabic",
    sourceLanguage: "Auto",
    selectedModels: ['gemini-2.5-flash', 'gemini-3-flash-preview'],
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [previewNovelId, setPreviewNovelId] = useState<string | null>(null);
  const [previewChapters, setPreviewChapters] = useState<Chapter[]>([]);
  const [selectedPreviewChapter, setSelectedPreviewChapter] = useState<Chapter | null>(null);

  const t = {
    en: {
      title: "Lumina",
      subtitle: "Novel Translation Engine",
      start: "Start Translation",
      stop: "Stop",
      download: "Download Results",
      apiKeys: "API Keys",
      active: "Active",
      enterKey: "Enter Gemini API Key...",
      config: "Configuration",
      prompt: "Translation Prompt",
      models: "Model Fallback Order",
      logs: "System Logs",
      clear: "Clear",
      uploadTitle: "Upload your novel",
      uploadDesc: "Drop your .txt file here or click to browse. We'll automatically split it into chapters.",
      selectFile: "Select File",
      totalChapters: "Total Chapters",
      completed: "Completed",
      remaining: "Remaining",
      queue: "Translation Queue",
      reset: "Reset Queue",
      original: "Original Text",
      translation: "Arabic Translation",
      copy: "Copy Translation",
      close: "Close",
      noKeys: "No keys added yet",
      selectRange: "Select Range",
      from: "From",
      to: "To",
      apply: "Apply",
      selected: "Selected",
      all: "All",
      none: "None",
      library: "Library",
      selectNovel: "Select Novel",
      addNovel: "Add to Library",
      noNovels: "No novels in library",
      deleteNovel: "Delete Novel",
      loadNovel: "Load Novel"
    },
    ar: {
      title: "لومينا",
      subtitle: "محرك ترجمة الروايات",
      start: "بدء الترجمة",
      stop: "إيقاف",
      download: "تحميل النتائج",
      apiKeys: "مفاتيح API",
      active: "نشط",
      enterKey: "أدخل مفتاح Gemini API...",
      config: "الإعدادات",
      prompt: "موجه الترجمة",
      models: "ترتيب النماذج البديلة",
      logs: "سجلات النظام",
      clear: "مسح",
      uploadTitle: "ارفع روايتك",
      uploadDesc: "اسحب ملف .txt هنا أو انقر للتصفح. سنقوم بتقسيمها تلقائياً إلى فصول.",
      selectFile: "اختر ملف",
      totalChapters: "إجمالي الفصول",
      completed: "مكتمل",
      remaining: "متبقي",
      queue: "طابور الترجمة",
      reset: "إعادة تعيين",
      original: "النص الأصلي",
      translation: "الترجمة العربية",
      copy: "نسخ الترجمة",
      close: "إغلاق",
      noKeys: "لم يتم إضافة مفاتيح بعد",
      selectRange: "تحديد نطاق",
      from: "من",
      to: "إلى",
      apply: "تطبيق",
      selected: "محدد",
      all: "الكل",
      none: "لا شيء",
      library: "المخزن",
      selectNovel: "اختر رواية",
      addNovel: "إضافة للمخزن",
      noNovels: "لا توجد روايات في المخزن",
      deleteNovel: "حذف الرواية",
      loadNovel: "تحميل الرواية"
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(10);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info' | 'error' | 'success'}[]>([]);

  // Refs for rotation logic
  const currentKeyIndexRef = useRef(0);
  const currentModelIndexRef = useRef(0);
  const stopRequestedRef = useRef(false);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load keys, config, and novels from Supabase
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Fetch Keys
      const { data: keysData, error: keysError } = await supabase.from('api_keys').select('*');
      if (keysData && !keysError) {
        setKeys(keysData.map((k: any) => ({
          id: k.id,
          key: k.key_value || k.key, // Support both just in case
          label: k.label,
          isWorking: k.is_active ?? k.is_working,
          errorCount: k.error_count || 0,
          tokenUsage: k.token_usage || 0,
          quotaReached: k.quota_reached || false
        })));
      } else {
        const savedKeys = localStorage.getItem('lumina_keys');
        if (savedKeys) setKeys(JSON.parse(savedKeys));
      }

      // Fetch Config
      const { data: configData, error: configError } = await supabase.from('settings').select('*').eq('id', user.id).single();
      if (configData && !configError) {
        setConfig({
          prompt: configData.prompt,
          targetLanguage: configData.target_language,
          sourceLanguage: configData.source_language,
          selectedModels: configData.selected_models
        });
      }

      // Fetch Novels
      const { data: novelsData, error: novelsError } = await supabase.from('novels').select('*');
      if (novelsData && !novelsError) {
        setNovels(novelsData);
      }
    };
    fetchData();
  }, []);

  const fetchNovels = async () => {
    const { data, error } = await supabase.from('novels').select('*');
    if (data && !error) setNovels(data);
  };

  const [sessionTranslatedIds, setSessionTranslatedIds] = useState<Set<string>>(new Set());

  const loadNovelChapters = async (id: string) => {
    setNovelId(id);
    setSessionTranslatedIds(new Set()); // Reset session tracking when loading a novel
    const { data, error } = await supabase.from('chapters')
      .select('*')
      .eq('novel_id', id)
      .order('order_index', { ascending: true });
    
    if (data && !error) {
      const loadedChapters: Chapter[] = data.map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        translatedContent: c.translated_content,
        status: c.status as TranslationStatus,
        error: c.error,
        orderIndex: c.order_index || 0
      }));
      setChapters(loadedChapters);
      setSelectedIds(new Set(loadedChapters.map(c => c.id)));
      setRangeFrom(1);
      setRangeTo(Math.min(10, loadedChapters.length));
      addLog(`Loaded ${loadedChapters.length} chapters from library`, 'info');
      setIsLibraryOpen(false);
    }
  };

  const deleteNovel = async (id: string) => {
    await supabase.from('chapters').delete().eq('novel_id', id);
    await supabase.from('novels').delete().eq('id', id);
    fetchNovels();
    if (novelId === id) {
      setChapters([]);
      setNovelId(null);
    }
    addLog("Novel deleted from library", "info");
  };

  const downloadNovelFromLibrary = async (id: string, name: string) => {
    addLog(`Fetching translated chapters for "${name}"...`, "info");
    const { data, error } = await supabase.from('chapters')
      .select('translated_content, order_index')
      .eq('novel_id', id)
      .eq('status', TranslationStatus.COMPLETED)
      .order('order_index', { ascending: true });

    if (error) {
      addLog(`Error fetching chapters: ${error.message}`, "error");
      return;
    }

    if (!data || data.length === 0) {
      addLog("No translated chapters found for this novel.", "error");
      return;
    }

    const content = data
      .map((c: any) => `الفصل ${c.order_index + 1}\n\n${c.translated_content}`)
      .join('\n\n---\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_translated.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`Downloaded ${data.length} translated chapters for "${name}"`, "success");
  };

  const updateNovelName = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('novels').update({ name: newName.trim() }).eq('id', id);
    if (!error) {
      fetchNovels();
      setEditingNovelId(null);
      addLog("Novel renamed successfully", "success");
    }
  };

  const handlePreviewNovel = async (id: string) => {
    addLog("Loading preview...", "info");
    const { data, error } = await supabase.from('chapters')
      .select('*')
      .eq('novel_id', id)
      .order('order_index', { ascending: true });

    if (error) {
      addLog(`Error loading preview: ${error.message}`, "error");
      return;
    }

    if (data) {
      const loadedChapters: Chapter[] = data.map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        translatedContent: c.translated_content,
        status: c.status as TranslationStatus,
        error: c.error,
        orderIndex: c.order_index || 0
      }));
      setPreviewChapters(loadedChapters);
      setPreviewNovelId(id);
      if (loadedChapters.length > 0) {
        setSelectedPreviewChapter(loadedChapters[0]);
      }
    }
  };

  const closePreview = () => {
    setPreviewNovelId(null);
    setPreviewChapters([]);
    setSelectedPreviewChapter(null);
  };

  const deleteChapter = async (chapterId: string) => {
    if (!confirm("Are you sure you want to delete this chapter?")) return;

    const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
    
    if (error) {
      addLog(`Error deleting chapter: ${error.message}`, "error");
      return;
    }

    const updatedChapters = previewChapters.filter(c => c.id !== chapterId);
    setPreviewChapters(updatedChapters);
    
    if (selectedPreviewChapter?.id === chapterId) {
      setSelectedPreviewChapter(updatedChapters.length > 0 ? updatedChapters[0] : null);
    }
    
    addLog("Chapter deleted successfully", "success");
  };

  // Sync config to Supabase
  const saveConfig = async (newConfig: TranslationConfig) => {
    if (!user) return;
    setConfig(newConfig);
    await supabase.from('settings').upsert({
      id: user.id,
      prompt: newConfig.prompt,
      target_language: newConfig.targetLanguage,
      source_language: newConfig.sourceLanguage,
      selected_models: newConfig.selectedModels
    });
  };

  // Sync keys to Supabase
  const syncKeys = async (newKeys: ApiKey[]) => {
    setKeys(newKeys);
    localStorage.setItem('lumina_keys', JSON.stringify(newKeys));
    
    // Use the column names from the user's screenshot: key_value, is_active
    const { error } = await supabase.from('api_keys').upsert(newKeys.map(k => ({
      id: k.id.includes('-') ? k.id : undefined, // Only send if it looks like a UUID, otherwise let DB generate
      key_value: k.key,
      label: k.label,
      is_active: k.isWorking,
      token_usage: k.tokenUsage,
      quota_reached: k.quotaReached
    })));

    if (error) {
      console.error("Supabase sync error:", error);
      addLog(`Database sync failed: ${error.message}`, 'error');
    }
  };

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  const handleAddKey = async (newKey: string) => {
    if (!newKey.trim()) return;
    // Generate a pseudo-UUID for Supabase if needed, or just let it be generated
    const keyObj: ApiKey = {
      id: crypto.randomUUID(), // Use standard crypto.randomUUID()
      key: newKey.trim(),
      label: `Key ${keys.length + 1}`,
      isWorking: true,
      errorCount: 0
    };
    const updatedKeys = [...keys, keyObj];
    await syncKeys(updatedKeys);
    addLog(`Added new API key: ${keyObj.label}`, 'success');
  };

  const removeKey = async (id: string) => {
    const updatedKeys = keys.filter(k => k.id !== id);
    setKeys(updatedKeys);
    localStorage.setItem('lumina_keys', JSON.stringify(updatedKeys));
    await supabase.from('api_keys').delete().eq('id', id);
  };

  const saveChapterToSupabase = async (chapter: Chapter, novel_id: string) => {
    await supabase.from('chapters').upsert({
      id: chapter.id,
      novel_id: novel_id,
      title: chapter.title,
      content: chapter.content,
      translated_content: chapter.translatedContent,
      status: chapter.status,
      error: chapter.error,
      order_index: chapter.orderIndex
    });
  };

  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a "Novel" record in Supabase
    const newNovelId = Math.random().toString(36).substr(2, 9);
    setNovelId(newNovelId);
    await supabase.from('novels').insert({ id: newNovelId, name: file.name });

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      
      // Comprehensive regex for Chinese and English chapter markers
      // Matches: 第1章, 第一百二十三章, Chapter 1, # Chapter Title, etc.
      // We look for markers at the start of a line or the very beginning of the string
      const splitRegex = /(?:\r?\n|^)(?=第[0-9一二三四五六七八九十百千万]+[章节]|Chapter\s+\d+|[#]{1,3}\s+|楔子|番外|序言|正文|第[0-9一二三四五六七八九十百千万]+[回部节])/gi;
      
      const parts = text.split(splitRegex);
      let splitChapters: Chapter[] = [];
      
      parts.forEach((part, index) => {
        const trimmed = part.trim();
        // Skip if total length is too short (e.g. just a title)
        if (!trimmed || trimmed.length < 20) return; 
        
        const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        // If only 1 line (the title) or very few lines, check content density
        if (lines.length < 2) return;

        let title = lines[0].trim();
        
        // Calculate body content length (excluding title)
        const bodyContent = lines.slice(1).join('\n').trim();
        
        // If body content is too short (e.g. < 50 chars), skip
        // This handles "Chapter 7" followed by empty space or just a title repetition
        if (bodyContent.length < 50) return;
        
        // Check if this part actually starts with a marker
        const hasMarker = title.match(/第|[Cc]hapter|#|楔子|番外|序言|正文/);
        
        // If it's the first part and has no marker, it's likely an introduction/metadata
        // User requested to skip small introductions too, so we rely on the length check above.
        if (index === 0 && !hasMarker) {
          title = lang === 'ar' ? "مقدمة / معلومات" : "Intro / Metadata";
        } else if (title.length > 100) {
          // If the first line is too long, it's probably not a title, use a generic one
          title = (lang === 'ar' ? "فصل " : "Chapter ") + (splitChapters.length + 1);
        }
        
        splitChapters.push({
          id: Math.random().toString(36).substr(2, 9),
          title: title,
          content: trimmed,
          status: TranslationStatus.IDLE,
          orderIndex: splitChapters.length
        });
      });

      if (splitChapters.length === 0) {
        // Fallback: split by roughly 3000 characters if no markers found
        const chunkSize = 3000;
        for (let i = 0; i < text.length; i += chunkSize) {
          splitChapters.push({
            id: Math.random().toString(36).substr(2, 9),
            title: (lang === 'ar' ? "جزء " : "Part ") + (Math.floor(i / chunkSize) + 1),
            content: text.substring(i, i + chunkSize).trim(),
            status: TranslationStatus.IDLE,
            orderIndex: Math.floor(i / chunkSize)
          });
        }
      }
      
      setChapters(splitChapters);
      // Auto-select all chapters by default for convenience
      setSelectedIds(new Set(splitChapters.map(c => c.id)));
      // Reset range inputs to match the new file
      setRangeFrom(1);
      setRangeTo(Math.min(10, splitChapters.length));
      
      addLog(`Loaded ${splitChapters.length} chapters from file`, 'info');
      fetchNovels();

      // Sync initial chapters to Supabase
      for (const ch of splitChapters) {
        await saveChapterToSupabase(ch, newNovelId);
      }
    };
    reader.readAsText(file);
  };

  const translateChapter = async (chapter: Chapter, key: string, model: string): Promise<{text: string, tokens: number}> => {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        { role: 'user', parts: [{ text: `${config.prompt}\n\nContent to translate:\n${chapter.content}` }] }
      ],
    });
    
    if (!response.text) {
      throw new Error("Empty response from model");
    }

    // Extract token usage if available
    const tokens = response.usageMetadata?.totalTokenCount || 0;
    
    return { text: response.text, tokens };
  };

  const startTranslation = async () => {
    if (keys.length === 0) {
      addLog("No API keys provided!", "error");
      return;
    }
    if (chapters.length === 0) {
      addLog("No chapters loaded!", "error");
      return;
    }
    if (config.selectedModels.length === 0) {
      addLog("No models selected!", "error");
      return;
    }

    setIsTranslating(true);
    stopRequestedRef.current = false;
    addLog("Starting translation process...", "info");
    
    let workingKeys = [...keys];
    
    // Automatically reset quotaReached status for all keys at the start of a new session
    if (workingKeys.some(k => k.quotaReached)) {
      workingKeys = workingKeys.map(k => ({ ...k, quotaReached: false }));
      await syncKeys(workingKeys);
      addLog("Automatically reset quota status for all keys.", "info");
    }

    const updatedChapters = [...chapters];
    const chaptersToTranslate = updatedChapters.filter(c => selectedIds.has(c.id));
    
    for (let i = 0; i < updatedChapters.length; i++) {
      if (stopRequestedRef.current) break;
      if (!selectedIds.has(updatedChapters[i].id)) continue;
      if (updatedChapters[i].status === TranslationStatus.COMPLETED) continue;

      setCurrentChapterIndex(i);
      updatedChapters[i].status = TranslationStatus.PROCESSING;
      setChapters([...updatedChapters]);

      let success = false;
      let attemptCount = 0;
      const maxAttempts = workingKeys.length * config.selectedModels.length;

      while (!success && attemptCount < maxAttempts && !stopRequestedRef.current) {
        const currentKey = workingKeys[currentKeyIndexRef.current];
        const currentModel = config.selectedModels[currentModelIndexRef.current];

        if (currentKey.quotaReached) {
          // Skip this key entirely and count all its models as failed attempts
          attemptCount += config.selectedModels.length;
          currentKeyIndexRef.current = (currentKeyIndexRef.current + 1) % workingKeys.length;
          currentModelIndexRef.current = 0; // Reset model index for the new key
          continue;
        }

        try {
          addLog(`Translating "${updatedChapters[i].title}" using ${currentKey.label} and ${currentModel}...`);
          const { text: translated, tokens } = await translateChapter(updatedChapters[i], currentKey.key, currentModel);
          
          // Update key token usage
          workingKeys = [...workingKeys];
          const keyIdx = currentKeyIndexRef.current;
          workingKeys[keyIdx] = {
            ...workingKeys[keyIdx],
            tokenUsage: (workingKeys[keyIdx].tokenUsage || 0) + tokens
          };
          syncKeys(workingKeys);

          updatedChapters[i].translatedContent = translated;
          updatedChapters[i].status = TranslationStatus.COMPLETED;
          setChapters([...updatedChapters]);
          
          // Save to Supabase
          if (novelId) {
            await saveChapterToSupabase(updatedChapters[i], novelId);
          }
          
          success = true;
          // Add to session tracking
          setSessionTranslatedIds(prev => new Set(prev).add(updatedChapters[i].id));
          addLog(`Successfully translated "${updatedChapters[i].title}" (${tokens} tokens)`, 'success');
        } catch (error: any) {
          attemptCount++;
          const isQuotaError = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
          
          if (isQuotaError) {
            addLog(`Quota reached for ${currentModel} on ${currentKey.label}. Switching model...`, 'error');
          } else {
            addLog(`Error with ${currentKey.label} / ${currentModel}: ${error.message || 'Unknown error'}`, 'error');
          }
          
          // Rotate model first
          currentModelIndexRef.current = (currentModelIndexRef.current + 1) % config.selectedModels.length;
          
          // If we've cycled through all models, rotate key
          if (currentModelIndexRef.current === 0) {
            // Mark key as quota reached if it failed on all models
            workingKeys = [...workingKeys];
            workingKeys[currentKeyIndexRef.current].quotaReached = true;
            syncKeys(workingKeys);

            currentKeyIndexRef.current = (currentKeyIndexRef.current + 1) % workingKeys.length;
            if (attemptCount < maxAttempts) {
              addLog(`Cycled through all models. Switching to key: ${workingKeys[currentKeyIndexRef.current].label}`, 'info');
            }
          }
        }
      }

      if (!success && !stopRequestedRef.current) {
        updatedChapters[i].status = TranslationStatus.FAILED;
        updatedChapters[i].error = "All keys and models failed.";
        setChapters([...updatedChapters]);
        addLog(`Failed to translate "${updatedChapters[i].title}" after ${attemptCount} attempts.`, 'error');
      }
    }

    setIsTranslating(false);
    setCurrentChapterIndex(-1);
    addLog("Translation process finished.", "info");
  };

  const stopTranslation = () => {
    stopRequestedRef.current = true;
    setIsTranslating(false);
    addLog("Stop requested. Finishing current task...", "info");
  };

  const downloadResults = () => {
    const chaptersToDownload = chapters.filter(c => 
      c.status === TranslationStatus.COMPLETED && sessionTranslatedIds.has(c.id)
    );

    if (chaptersToDownload.length === 0) {
      addLog("No new translations to download in this session.", "info");
      return;
    }

    const content = chaptersToDownload
      .map(c => `الفصل ${c.orderIndex + 1}\n\n${c.translatedContent}`)
      .join('\n\n---\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translated_novel.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedChapters = chapters.filter(c => selectedIds.has(c.id));
  const completedSelected = selectedChapters.filter(c => c.status === TranslationStatus.COMPLETED).length;
  const progressPercent = selectedChapters.length > 0 
    ? Math.round((completedSelected / selectedChapters.length) * 100) 
    : 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => {}} lang={lang} />;
  }

  return (
    <div className={cn(
      "min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-emerald-100",
      lang === 'ar' ? "text-right" : "text-left"
    )} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
        {!isSupabaseConfigured && (
          <div className="absolute top-full left-0 right-0 bg-red-500 text-white text-center py-2 text-xs font-bold">
            Warning: Database connection not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.
          </div>
        )}
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Languages className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t[lang].title}</h1>
              <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{t[lang].subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsLibraryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 text-zinc-600 text-xs font-bold hover:bg-zinc-200 transition-colors"
            >
              <Library className="w-4 h-4" />
              {t[lang].library}
            </button>
            <button 
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-bold hover:bg-zinc-200 transition-colors"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>

            <button 
              onClick={handleLogout}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
              title={lang === 'ar' ? "تسجيل الخروج" : "Logout"}
            >
              <LogOut className="w-5 h-5" />
            </button>

            <button 
              onClick={isTranslating ? stopTranslation : startTranslation}
              disabled={chapters.length === 0 || (selectedIds.size === 0 && !isTranslating)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                isTranslating 
                  ? "bg-red-50 text-red-600 hover:bg-red-100" 
                  : "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-emerald-200 shadow-md"
              )}
            >
              {isTranslating ? (
                <><Pause className="w-4 h-4" /> {t[lang].stop}</>
              ) : (
                <><Play className="w-4 h-4" /> {t[lang].start}</>
              )}
            </button>
            
            {chapters.some(c => c.status === TranslationStatus.COMPLETED) && (
              <button 
                onClick={downloadResults}
                className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                title={t[lang].download}
              >
                <Download className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Config & Keys */}
        <div className="lg:col-span-4 space-y-6">
          {/* API Keys Section */}
          <section className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-lg">{t[lang].apiKeys}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-zinc-100 px-2 py-1 rounded text-zinc-500">
                  {keys.length} {t[lang].active}
                </span>
                {keys.some(k => k.quotaReached) && (
                  <button 
                    onClick={() => {
                      const updatedKeys = keys.map(k => ({ ...k, quotaReached: false }));
                      syncKeys(updatedKeys);
                      addLog("Quotas reset for all keys", "info");
                    }}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-tight transition-colors"
                  >
                    {lang === 'ar' ? "إعادة تعيين" : "Reset"}
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-3 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {keys.map((k) => (
                  <motion.div 
                    key={k.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between p-3 bg-zinc-50 rounded-2xl border border-zinc-100 group"
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          k.quotaReached ? "bg-amber-500" : (k.isWorking ? "bg-emerald-500" : "bg-red-500")
                        )} />
                        <span className="text-sm font-medium truncate">{k.label}</span>
                        <span className="text-[10px] text-zinc-400 font-mono shrink-0">••••{k.key?.slice(-4) || '****'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">
                          {k.tokenUsage?.toLocaleString() || 0} Tokens
                        </span>
                        {k.quotaReached && (
                          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter bg-amber-50 px-1 rounded">
                            {lang === 'ar' ? "وصل للحد" : "Limit Reached"}
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => removeKey(k.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {keys.length === 0 && (
                <div className="text-center py-8 text-zinc-400">
                  <p className="text-sm italic">{t[lang].noKeys}</p>
                </div>
              )}
            </div>

            <div className="relative">
              <input 
                type="password" 
                placeholder={t[lang].enterKey}
                className="w-full pl-4 pr-12 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddKey((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <button 
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  handleAddKey(input.value);
                  input.value = '';
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </section>

          {/* Chapter Selection Range */}
          {chapters.length > 0 && (
            <section className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-lg">{t[lang].selectRange}</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 mb-1 block">{t[lang].from}</label>
                  <input 
                    type="number" 
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(parseInt(e.target.value))}
                    min={1}
                    max={chapters.length}
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 mb-1 block">{t[lang].to}</label>
                  <input 
                    type="number" 
                    value={rangeTo}
                    onChange={(e) => setRangeTo(parseInt(e.target.value))}
                    min={1}
                    max={chapters.length}
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <button 
                onClick={() => {
                  const newSelected = new Set(selectedIds);
                  for (let i = rangeFrom - 1; i < rangeTo; i++) {
                    if (chapters[i]) newSelected.add(chapters[i].id);
                  }
                  setSelectedIds(newSelected);
                  addLog(`Selected chapters ${rangeFrom} to ${rangeTo}`, 'info');
                }}
                className="w-full py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all"
              >
                {t[lang].apply}
              </button>
            </section>
          )}

          {/* Configuration Section */}
          <section className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-lg">{t[lang].config}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block">{t[lang].prompt}</label>
                  <button 
                    onClick={() => {
                      saveConfig(config);
                      addLog("Settings saved to database", "success");
                    }}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-tight flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {lang === 'ar' ? "حفظ الإعدادات" : "Save Settings"}
                  </button>
                </div>
                <textarea 
                  value={config.prompt}
                  onChange={(e) => setConfig({...config, prompt: e.target.value})}
                  className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm min-h-32 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 mb-2 block">{t[lang].models}</label>
                <div className="grid grid-cols-1 gap-2">
                  {AVAILABLE_MODELS.map(model => (
                    <label 
                      key={model.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all",
                        config.selectedModels.includes(model.id)
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-zinc-50 border-zinc-100 text-zinc-600 hover:border-zinc-200"
                      )}
                    >
                      <span className="text-sm font-medium">{model.name}</span>
                      <input 
                        type="checkbox"
                        className="hidden"
                        checked={config.selectedModels.includes(model.id)}
                        onChange={() => {
                          const newModels = config.selectedModels.includes(model.id)
                            ? config.selectedModels.filter(m => m !== model.id)
                            : [...config.selectedModels, model.id];
                          saveConfig({...config, selectedModels: newModels});
                        }}
                      />
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        config.selectedModels.includes(model.id)
                          ? "bg-emerald-600 border-emerald-600"
                          : "border-zinc-300"
                      )}>
                        {config.selectedModels.includes(model.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Logs Section */}
          <section className="bg-zinc-900 rounded-3xl p-6 shadow-xl text-zinc-300 h-64 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t[lang].logs}</h3>
              <button onClick={() => setLogs([])} className="text-[10px] hover:text-white transition-colors">{t[lang].clear}</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] custom-scrollbar">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                  <span className={cn(
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'success' ? 'text-emerald-400' : 'text-zinc-300'
                  )}>
                    {log.msg}
                  </span>
                </div>
              ))}
              {logs.length === 0 && <p className="text-zinc-600 italic">No activity yet...</p>}
            </div>
          </section>
        </div>

        {/* Right Column: Content & Progress */}
        <div className="lg:col-span-8 space-y-6">
          {/* File Upload Area */}
          {chapters.length === 0 ? (
            <div className="h-[600px] border-2 border-dashed border-zinc-200 rounded-[40px] flex flex-col items-center justify-center p-12 text-center bg-white group hover:border-emerald-400 transition-all">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold mb-2">{t[lang].uploadTitle}</h3>
              <p className="text-zinc-500 max-w-sm mb-8">
                {t[lang].uploadDesc}
              </p>
              <label className="px-8 py-3 bg-emerald-600 text-white rounded-full font-bold cursor-pointer hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95">
                {t[lang].selectFile}
                <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{t[lang].totalChapters}</p>
                  <p className="text-3xl font-bold">{chapters.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{t[lang].completed}</p>
                  <p className="text-3xl font-bold text-emerald-600">{chapters.filter(c => c.status === TranslationStatus.COMPLETED).length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{t[lang].remaining}</p>
                  <p className="text-3xl font-bold text-zinc-400">{chapters.filter(c => c.status === TranslationStatus.IDLE || c.status === TranslationStatus.FAILED).length}</p>
                </div>
              </div>

              {/* Progress Bar */}
              {(isTranslating || progressPercent > 0) && (
                <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        isTranslating ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"
                      )} />
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        {lang === 'ar' ? "تقدم الترجمة" : "Translation Progress"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                      className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    />
                  </div>
                </div>
              )}

              {/* Chapter List */}
              <div className="bg-white rounded-[40px] border border-zinc-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg">{t[lang].queue}</h3>
                    <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-full">
                      <button 
                        onClick={() => setSelectedIds(new Set(chapters.map(c => c.id)))}
                        className="px-3 py-1 text-[10px] font-bold uppercase rounded-full hover:bg-white transition-all"
                      >
                        {t[lang].all}
                      </button>
                      <button 
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-1 text-[10px] font-bold uppercase rounded-full hover:bg-white transition-all"
                      >
                        {t[lang].none}
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setChapters([]);
                      setSelectedIds(new Set());
                    }}
                    className="text-xs text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> {t[lang].reset}
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {chapters.map((chapter, idx) => (
                    <motion.div 
                      key={chapter.id}
                      layout
                      className={cn(
                        "p-4 rounded-3xl border transition-all flex items-center justify-between cursor-pointer group",
                        chapter.status === TranslationStatus.PROCESSING ? "bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/10" :
                        chapter.status === TranslationStatus.COMPLETED ? "bg-zinc-50 border-zinc-100 opacity-80" :
                        chapter.status === TranslationStatus.FAILED ? "bg-red-50 border-red-100" :
                        "bg-white border-zinc-100 hover:border-emerald-200"
                      )}
                    >
                      <div className="flex items-center gap-4 flex-1" onClick={() => setSelectedChapter(chapter)}>
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm",
                          chapter.status === TranslationStatus.PROCESSING ? "bg-emerald-600 text-white animate-pulse" :
                          chapter.status === TranslationStatus.COMPLETED ? "bg-emerald-100 text-emerald-700" :
                          chapter.status === TranslationStatus.FAILED ? "bg-red-100 text-red-700" :
                          "bg-zinc-100 text-zinc-400"
                        )}>
                          {chapter.status === TranslationStatus.COMPLETED ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm line-clamp-1">{chapter.title}</h4>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                            {chapter.status} {chapter.status === TranslationStatus.PROCESSING && "..."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <input 
                          type="checkbox"
                          checked={selectedIds.has(chapter.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedIds);
                            if (e.target.checked) newSelected.add(chapter.id);
                            else newSelected.delete(chapter.id);
                            setSelectedIds(newSelected);
                          }}
                          className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          {chapter.status === TranslationStatus.COMPLETED && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(chapter.translatedContent || '');
                                addLog(`Copied ${chapter.title} translation to clipboard`, 'info');
                              }}
                              className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                              title={t[lang].copy}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {chapter.status === TranslationStatus.FAILED && (
                            <div className="p-2 text-red-400" title={chapter.error}>
                              <AlertCircle className="w-5 h-5" />
                            </div>
                          )}
                          {chapter.status === TranslationStatus.PROCESSING && (
                            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {chapters.some(c => c.status === TranslationStatus.COMPLETED) && (
                  <div className="p-6 bg-zinc-50 border-t border-zinc-100">
                    <button 
                      onClick={downloadResults}
                      className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" /> {t[lang].download}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-2 text-[10px] text-zinc-400 flex justify-between items-center z-50">
        <div className="flex gap-4">
          <span>{t[lang].apiKeys}: {keys.filter(k => k.isWorking).length}</span>
          <span>{t[lang].models}: {config.selectedModels.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", isTranslating ? "bg-emerald-500 animate-pulse" : "bg-zinc-300")} />
          <span className="uppercase font-bold tracking-widest">{isTranslating ? (lang === 'ar' ? "المحرك يعمل" : "Engine Running") : (lang === 'ar' ? "المحرك متوقف" : "Engine Idle")}</span>
        </div>
      </footer>

      {/* Library Modal */}
      <AnimatePresence>
        {isLibraryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLibraryOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Library className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t[lang].library}</h2>
                    <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{t[lang].selectNovel}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLibraryOpen(false)}
                  className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5 rotate-45 text-zinc-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {novels.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 italic flex flex-col items-center gap-4">
                    <FileText className="w-12 h-12 opacity-10" />
                    <p>{t[lang].noNovels}</p>
                  </div>
                ) : (
                  novels.map((novel) => (
                    <div 
                      key={novel.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-3xl border transition-all group",
                        novelId === novel.id 
                          ? "bg-emerald-50 border-emerald-200" 
                          : "bg-zinc-50 border-zinc-100 hover:border-zinc-200"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-zinc-100">
                          <FileText className="w-6 h-6 text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingNovelId === novel.id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                autoFocus
                                value={editingNovelName}
                                onChange={(e) => setEditingNovelName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updateNovelName(novel.id, editingNovelName);
                                  if (e.key === 'Escape') setEditingNovelId(null);
                                }}
                                className="bg-white border border-emerald-200 rounded-lg px-2 py-1 text-sm font-bold w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                              />
                              <button 
                                onClick={() => updateNovelName(novel.id, editingNovelName)}
                                className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group/title">
                              <h4 className="font-bold text-zinc-900 truncate">{novel.name}</h4>
                              <button 
                                onClick={() => {
                                  setEditingNovelId(novel.id);
                                  setEditingNovelName(novel.name);
                                }}
                                className="opacity-0 group-hover/title:opacity-100 p-1 text-zinc-400 hover:text-emerald-600 transition-all"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">ID: {novel.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handlePreviewNovel(novel.id)}
                          className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 transition-all"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => downloadNovelFromLibrary(novel.id, novel.name)}
                          className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 transition-all"
                          title={t[lang].download}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => loadNovelChapters(novel.id)}
                          className="px-4 py-2 bg-zinc-900 text-white rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-all"
                        >
                          {t[lang].loadNovel}
                        </button>
                        <button 
                          onClick={() => deleteNovel(novel.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewNovelId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePreview}
              className="absolute inset-0 bg-zinc-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl h-[90vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Novel Preview</h2>
                    <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                      {novels.find(n => n.id === previewNovelId)?.name || 'Unknown Novel'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={closePreview}
                  className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Chapter List */}
                <div className="w-80 border-r border-zinc-100 bg-zinc-50/50 flex flex-col">
                  <div className="p-4 border-b border-zinc-100">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Chapters ({previewChapters.length})</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {previewChapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all mb-1 group",
                          selectedPreviewChapter?.id === chapter.id
                            ? "bg-emerald-100 text-emerald-900 shadow-sm"
                            : "text-zinc-600 hover:bg-zinc-100"
                        )}
                      >
                        <button
                          onClick={() => setSelectedPreviewChapter(chapter)}
                          className="flex-1 text-left truncate mr-2 focus:outline-none"
                        >
                          <div className="flex items-center gap-2">
                             <span className="truncate">{chapter.title}</span>
                             {chapter.status === TranslationStatus.COMPLETED && (
                               <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                             )}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChapter(chapter.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Chapter"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                  {selectedPreviewChapter ? (
                    <div className="grid grid-cols-2 h-full divide-x divide-zinc-100">
                      {/* Original Content */}
                      <div className="p-8 overflow-y-auto custom-scrollbar">
                        <div className="sticky top-0 bg-white/90 backdrop-blur pb-4 mb-4 border-b border-zinc-100 z-10">
                          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Original Text
                          </h3>
                        </div>
                        <div className="prose prose-sm max-w-none text-zinc-600 whitespace-pre-wrap font-mono leading-relaxed">
                          {selectedPreviewChapter.content}
                        </div>
                      </div>

                      {/* Translated Content */}
                      <div className="p-8 overflow-y-auto custom-scrollbar bg-zinc-50/30">
                        <div className="sticky top-0 bg-zinc-50/90 backdrop-blur pb-4 mb-4 border-b border-zinc-100 z-10">
                          <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                            <Languages className="w-4 h-4" /> Translation
                          </h3>
                        </div>
                        {selectedPreviewChapter.translatedContent ? (
                          <div className="prose prose-sm max-w-none text-zinc-800 whitespace-pre-wrap font-serif leading-relaxed" dir="rtl">
                            {selectedPreviewChapter.translatedContent}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-64 text-zinc-400 italic">
                            <Languages className="w-8 h-8 mb-2 opacity-20" />
                            <p>Not translated yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-400">
                      <p>Select a chapter to preview</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {selectedChapter && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedChapter(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h3 className="text-2xl font-bold">{selectedChapter.title}</h3>
                  <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider">{t[lang].translation}</p>
                </div>
                <button 
                  onClick={() => setSelectedChapter(null)}
                  className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors shadow-sm"
                >
                  <Plus className="w-6 h-6 rotate-45 text-zinc-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-2">{t[lang].original}</h4>
                  <div className="text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap font-serif">
                    {selectedChapter.content}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 border-b border-emerald-100 pb-2">{t[lang].translation}</h4>
                  <div className="text-lg leading-loose text-zinc-900 whitespace-pre-wrap font-serif text-right dir-rtl" dir="rtl">
                    {selectedChapter.translatedContent || (
                      <div className="flex flex-col items-center justify-center py-20 text-zinc-300 italic">
                        <Languages className="w-12 h-12 mb-4 opacity-20" />
                        <p>{t[lang].noKeys}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3">
                {selectedChapter.translatedContent && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(selectedChapter.translatedContent || '');
                      addLog(`Copied ${selectedChapter.title} translation`, 'info');
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-zinc-200 rounded-full text-sm font-bold hover:bg-zinc-100 transition-all"
                  >
                    <Copy className="w-4 h-4" /> {t[lang].copy}
                  </button>
                )}
                <button 
                  onClick={() => setSelectedChapter(null)}
                  className="px-8 py-2.5 bg-zinc-900 text-white rounded-full text-sm font-bold hover:bg-zinc-800 transition-all"
                >
                  {t[lang].close}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E4E4E7;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D4D4D8;
        }
        .dir-rtl {
          direction: rtl;
        }
      `}</style>
    </div>
  );
}
