import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Session, Species, SessionType, AppSettings, WeatherInfo, UserConfig } from './types';
import { SettingsPanel } from './components/SettingsPanel';
import { SessionView } from './components/SessionView';
import { 
  Layout, ClipboardList, MapPin, Calendar, Clock, Play, Trash, Sun, Moon, 
  Settings as SettingsIcon, LogOut, FileText, Binoculars, BookOpen, ExternalLink, 
  X, Cloud, Wind, Thermometer, Globe, Info, Mail, User, LogIn, CheckCircle, 
  AlertCircle, Loader2, Edit2, Droplets, Upload, Download, MoreVertical, FileJson, Table,
  CloudOff, Save as SaveIcon
} from 'lucide-react';
import { validateWordPressCredentials, syncSessionToWordPress } from './services/wordpressService';
import { DEFAULT_SPECIES } from './speciesData';
import { generateCSV, generateJSON, generatePDF, generateTextSummary } from './utils/exportUtils';

const DEFAULT_SETTINGS: AppSettings = {
  speciesList: DEFAULT_SPECIES,
  theme: 'light',
  language: 'en',
  rules: [],
  codes: {
    age: ['Juv', 'Imm', 'Ad', 'Non-Juv', 'Non-adult', 'Unk'],
    sex: ['F', 'M', 'FC', 'Unk'],
    distance: ['w3', 'w2', 'w1', 'o', 'e1', 'e2', 'e3'],
    direction: ['N', 'S', 'Local', 'E', 'W', 'NE', 'NW', 'SE', 'SW'],
    status: ['Active', 'Killed', 'Injured', 'Resting'],
    morph: ['Light', 'Dark'],
    countType: ['Single', 'Double']
  },
  fields: {
    age: true,
    sex: true,
    distance: true,
    direction: true,
    morph: true,
    countType: true
  }
};

const MOCK_ARTICLES = [
    { id: 1, title: "Spring Migration 2025 Forecast", date: "2025-02-15", url: "#" },
    { id: 2, title: "Identification Guide: Juvenile Gulls", date: "2024-11-20", url: "#" },
    { id: 3, title: "Best Binoculars for Low Light", date: "2024-10-05", url: "#" },
    { id: 4, title: "Conservation Status of Local Wetlands", date: "2024-09-12", url: "#" },
    { id: 5, title: "Rare Sightings Report: Feb 2025", date: "2025-02-28", url: "#" },
];

const LANGUAGES = {
  en: { label: 'English', dir: 'ltr' },
  fa: { label: 'فارسی', dir: 'rtl' },
  fr: { label: 'Français', dir: 'ltr' },
  de: { label: 'Deutsch', dir: 'ltr' },
  ar: { label: 'العربية', dir: 'rtl' },
  ru: { label: 'Русский', dir: 'ltr' },
};

const TRANSLATIONS: Record<string, any> = {
  en: {
    welcome: "Welcome Back",
    ready: "Ready to start counting?",
    startBtn: "Start New Session",
    recent: "Recent Sessions",
    noSessions: "No sessions yet. Start your first bird count!",
    setupTitle: "Setup New Count",
    backDash: "Back to Dashboard",
    locName: "Location Name",
    date: "Date",
    time: "Start Time",
    observers: "Observers",
    weather: "Weather Conditions (Optional)",
    startCount: "Start Counting",
    tripMode: "Birding Trip",
    tripDesc: "Simple list & counts",
    migMode: "Migration Count",
    migDesc: "Detailed entries",
    articles: "Latest Articles",
    about: "About Us",
    aboutTitle: "About OrniCount Pro",
    contact: "Contact Us",
    version: "Version 1.2.0",
    login: "Log In",
    logout: "Log Out",
    website: "Website URL",
    username: "Username",
    appPass: "Application Password",
    restoreTitle: "Unsaved Session Found",
    restoreMsg: "You have an active session that wasn't closed properly. Do you want to continue it?",
    restoreBtn: "Restore Session",
    discardBtn: "Discard",
    importBtn: "Import File"
  },
  fa: {
    welcome: "خوش آمدید",
    ready: "آماده شروع شمارش هستید؟",
    startBtn: "شروع جلسه جدید",
    recent: "جلسات اخیر",
    noSessions: "هنوز جلسه‌ای وجود ندارد. اولین شمارش پرنده خود را شروع کنید!",
    setupTitle: "تنظیم شمارش جدید",
    backDash: "بازگشت به داشبورد",
    locName: "نام مکان",
    date: "تاریخ",
    time: "زمان شروع",
    observers: "مشاهده‌کنندگان",
    weather: "شرایط جوی (اختیاری)",
    startCount: "شروع شمارش",
    tripMode: "سفر پرنده‌نگری",
    tripDesc: "لیست ساده و شمارش",
    migMode: "شمارش مهاجرت",
    migDesc: "ثبت جزئیات دقیق",
    articles: "آخرین مقالات",
    about: "درباره ما",
    aboutTitle: "درباره OrniCount حرفه‌ای",
    contact: "تماس با ما",
    version: "نسخه 1.2.0",
    login: "ورود",
    logout: "خروج",
    website: "آدرس وبسایت",
    username: "نام کاربری",
    appPass: "رمز عبور برنامه",
    restoreTitle: "جلسه ذخیره نشده یافت شد",
    restoreMsg: "شما یک جلسه فعال دارید که به درستی بسته نشده است. آیا می‌خواهید آن را ادامه دهید؟",
    restoreBtn: "بازیابی جلسه",
    discardBtn: "لغو",
    importBtn: "وارد کردن فایل"
  },
};

const EagleLogo = () => (
  <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg overflow-hidden p-0.5">
    <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
       <path d="M10,50 Q30,20 60,10 C80,5 95,20 90,40 C85,60 60,60 50,55 C45,65 30,75 10,65 Z" />
       <circle cx="70" cy="25" r="3" fill="white" />
    </svg>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [locationHistory, setLocationHistory] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showArticles, setShowArticles] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [user, setUser] = useState<UserConfig | null>(null);
  const [loginForm, setLoginForm] = useState<UserConfig>({ websiteUrl: '', username: '', appPassword: '' });
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [exportMenuOpen, setExportMenuOpen] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'acquired' | 'error'>('idle');
  
  // Auto-save toast
  const [showSaveToast, setShowSaveToast] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit Session Metadata State (Dashboard)
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState<{
      name: string;
      observers: string;
      date: string;
      startTime: string;
      temp: string;
      cloud: string;
      wind: string;
      precip: string;
      notes: string;
  }>({ name: '', observers: '', date: '', startTime: '', temp: '', cloud: '', wind: '', precip: '', notes: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (key: string) => {
    const lang = TRANSLATIONS[settings.language] ? settings.language : 'en';
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;
  };

  const [newSessionData, setNewSessionData] = useState<{
    name: string;
    date: string;
    startTime: string;
    observers: string;
    lat: string;
    lng: string;
    type: SessionType;
    temp: string;
    cloud: string;
    wind: string;
    precip: string;
  }>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    observers: '',
    lat: '',
    lng: '',
    type: 'trip',
    temp: '',
    cloud: '',
    wind: '',
    precip: ''
  });

  useEffect(() => {
    const savedSessions = localStorage.getItem('orni_sessions');
    const savedSettings = localStorage.getItem('orni_settings');
    const savedHistory = localStorage.getItem('orni_history');
    const savedUser = localStorage.getItem('orni_user');
    const lastActiveId = localStorage.getItem('orni_last_active_id');

    if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        // Auto-restore logic
        if (lastActiveId) {
            const possibleSession = parsedSessions.find((s: Session) => s.id === lastActiveId);
            if (possibleSession && possibleSession.status === 'active') {
                setPendingRestoreId(lastActiveId);
                setShowRestorePrompt(true);
            }
        }
    }
    
    if (savedSettings) {
       try {
         const parsed = JSON.parse(savedSettings);
         if (!parsed.speciesList || !Array.isArray(parsed.speciesList) || parsed.speciesList.length === 0) {
             parsed.speciesList = DEFAULT_SPECIES;
         }
         if (!parsed.codes) parsed.codes = DEFAULT_SETTINGS.codes;
         if (!parsed.fields) parsed.fields = DEFAULT_SETTINGS.fields;
         
         setSettings(parsed);
       } catch (e) {
         console.error("Failed to parse settings", e);
       }
    }

    if (savedHistory) setLocationHistory(JSON.parse(savedHistory));
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // Save Sessions & Trigger Toast
  useEffect(() => { 
      localStorage.setItem('orni_sessions', JSON.stringify(sessions)); 
      
      // Debounced Toast for Auto-save
      if (sessions.length > 0) {
          setShowSaveToast(true);
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => {
              setShowSaveToast(false);
          }, 2000);
      }
      
      return () => {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      };
  }, [sessions]);

  useEffect(() => { localStorage.setItem('orni_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('orni_history', JSON.stringify(locationHistory)); }, [locationHistory]);
  useEffect(() => {
       if (user) localStorage.setItem('orni_user', JSON.stringify(user));
       else localStorage.removeItem('orni_user');
  }, [user]);

  useEffect(() => {
      if (activeSessionId) localStorage.setItem('orni_last_active_id', activeSessionId);
      else localStorage.removeItem('orni_last_active_id');
  }, [activeSessionId]);

  useEffect(() => {
    const html = document.querySelector('html');
    if (settings.theme === 'dark') html?.classList.add('dark');
    else html?.classList.remove('dark');
    const dir = LANGUAGES[settings.language as keyof typeof LANGUAGES]?.dir || 'ltr';
    html?.setAttribute('dir', dir);
  }, [settings.theme, settings.language]);

  const fetchLocation = () => {
      if ('geolocation' in navigator) {
          setGpsStatus('locating');
          navigator.geolocation.getCurrentPosition((position) => {
              setNewSessionData(prev => ({
                  ...prev,
                  lat: position.coords.latitude.toFixed(6),
                  lng: position.coords.longitude.toFixed(6)
              }));
              setGpsStatus('acquired');
          }, (err) => {
              console.warn("Geolocation failed or denied", err);
              setGpsStatus('error');
          }, { timeout: 10000, enableHighAccuracy: true });
      } else {
          setGpsStatus('error');
      }
  };

  useEffect(() => {
      if (view === 'new-session') {
          fetchLocation();
      }
  }, [view]);

  const toggleTheme = () => setSettings(prev => ({...prev, theme: prev.theme === 'light' ? 'dark' : 'light'}));
  const changeLanguage = (langCode: string) => {
      setSettings(prev => ({...prev, language: langCode}));
      setShowLangMenu(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthStatus('loading');
      const isValid = await validateWordPressCredentials(loginForm);
      if (isValid) {
          setUser(loginForm);
          setAuthStatus('success');
          setTimeout(() => setShowLogin(false), 1000);
      } else {
          setAuthStatus('error');
      }
  };

  const handleSyncSession = async (sessionToSync: Session) => {
      if (!user) {
          setShowLogin(true);
          return;
      }
      setSyncStatus('syncing');
      try {
          const remoteId = await syncSessionToWordPress(sessionToSync, user);
          setSessions(prev => prev.map(s => s.id === sessionToSync.id ? { ...s, syncStatus: 'synced', remoteId } : s));
          setSyncStatus('success');
          setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (error) {
          console.error(error);
          setSessions(prev => prev.map(s => s.id === sessionToSync.id ? { ...s, syncStatus: 'error' } : s));
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 2000);
      }
  };

  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    const id = Date.now().toString();
    const newSession: Session = {
      id,
      type: newSessionData.type,
      name: newSessionData.name || `Session ${newSessionData.date}`,
      date: newSessionData.date,
      startTime: newSessionData.startTime,
      observers: newSessionData.observers || 'Self',
      notes: '',
      latitude: newSessionData.lat ? parseFloat(newSessionData.lat) : undefined,
      longitude: newSessionData.lng ? parseFloat(newSessionData.lng) : undefined,
      weather: {
          temperature: newSessionData.temp,
          cloudCover: newSessionData.cloud,
          windSpeed: newSessionData.wind,
          precipitation: newSessionData.precip
      },
      sightings: [],
      status: 'active',
      syncStatus: 'unsynced'
    };
    if (newSessionData.name && !locationHistory.includes(newSessionData.name)) {
        setLocationHistory([newSessionData.name, ...locationHistory].slice(0, 10));
    }
    setSessions([newSession, ...sessions]);
    setActiveSessionId(id);
    setView('active-session');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleReloadDefaults = () => {
      setSettings(prev => ({ ...prev, speciesList: DEFAULT_SPECIES }));
      alert("Default species list reloaded.");
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.id && json.sightings) {
             const importedSession = { ...json, id: Date.now().toString(), name: json.name + ' (Imported)' };
             setSessions([importedSession, ...sessions]);
             alert("Session imported successfully!");
        } else {
             alert("Invalid file format.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse file.");
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDashboardDownload = (type: 'csv' | 'json' | 'pdf' | 'text', session: Session) => {
      setExportMenuOpen(null);
      if (type === 'csv') generateCSV(session, settings.speciesList);
      if (type === 'json') generateJSON(session);
      if (type === 'pdf') generatePDF(session, settings.speciesList);
      if (type === 'text') {
          const text = generateTextSummary(session, settings.speciesList);
          navigator.clipboard.writeText(text);
          alert("Summary copied to clipboard!");
      }
  };

  const startEditingSession = (session: Session) => {
      setEditingSession(session);
      setEditForm({
          name: session.name,
          observers: session.observers,
          date: session.date,
          startTime: session.startTime,
          temp: session.weather?.temperature || '',
          cloud: session.weather?.cloudCover || '',
          wind: session.weather?.windSpeed || '',
          precip: session.weather?.precipitation || '',
          notes: session.notes || ''
      });
  };

  const saveEditedSession = () => {
      if (!editingSession) return;
      setSessions(prev => prev.map(s => s.id === editingSession.id ? {
          ...s,
          name: editForm.name,
          observers: editForm.observers,
          date: editForm.date,
          startTime: editForm.startTime,
          notes: editForm.notes,
          weather: {
              temperature: editForm.temp,
              cloudCover: editForm.cloud,
              windSpeed: editForm.wind,
              precipitation: editForm.precip
          }
      } : s));
      setEditingSession(null);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const renderSyncStatus = (s: Session) => {
      if (s.syncStatus === 'synced') return <CheckCircle size={14} className="text-green-500" />;
      if (s.syncStatus === 'error') return <AlertCircle size={14} className="text-red-500" />;
      return <Cloud size={14} className="text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 flex flex-col" onClick={() => setExportMenuOpen(null)}>
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-gray-200 dark:border-slate-800 z-50 px-4 md:px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
          <EagleLogo />
          <h1 className="text-xl font-bold tracking-tight hidden md:block">OrniCount <span className="text-primary font-light">Pro</span></h1>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          
          <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".json" />
          <button onClick={handleImportClick} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-300" title={t('importBtn')}>
              <Upload size={20} />
          </button>

          <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowArticles(!showArticles); }} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-300">
                  <BookOpen size={20} />
              </button>
              {showArticles && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right z-50">
                      <div className="p-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                          <h4 className="text-xs font-bold uppercase text-gray-500">{t('articles')}</h4>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                          {MOCK_ARTICLES.map(art => (
                              <a key={art.id} href={art.url} className="block p-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0">
                                  <div className="text-sm font-semibold dark:text-white leading-tight">{art.title}</div>
                                  <div className="text-[10px] text-gray-400 mt-1">{art.date}</div>
                              </a>
                          ))}
                      </div>
                  </div>
              )}
          </div>
          
          <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowLangMenu(!showLangMenu); }} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-300">
                  <Globe size={20} />
              </button>
              {showLangMenu && (
                  <div className="absolute top-full right-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50">
                      {Object.entries(LANGUAGES).map(([code, data]) => (
                          <button 
                            key={code} 
                            onClick={() => changeLanguage(code)}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 ${settings.language === code ? 'text-primary font-bold bg-primary/5' : 'text-slate-700 dark:text-gray-300'}`}
                        >
                              {data.label}
                          </button>
                      ))}
                  </div>
              )}
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-1"></div>

          <button onClick={toggleTheme} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            {settings.theme === 'light' ? <Moon size={20} className="text-slate-600" /> : <Sun size={20} className="text-yellow-400" />}
          </button>
          <button onClick={() => setView('settings')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <SettingsIcon size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          {user ? (
               <button onClick={() => { if(confirm(t('logout')+'?')) setUser(null); }} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors" title={user.username}>
                  <LogOut size={20} />
               </button>
          ) : (
               <button onClick={() => setShowLogin(true)} className="p-2 hover:bg-primary/10 hover:text-primary rounded-full transition-colors">
                  <LogIn size={20} />
               </button>
          )}
        </div>
      </header>

      <main className="pt-20 flex-1 flex flex-col relative z-0">
        {view === 'dashboard' && (
          <div className="max-w-4xl mx-auto p-6 md:p-8 w-full pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-bold mb-1 dark:text-white">{t('welcome')}</h2>
                <p className="text-gray-500 dark:text-gray-400">{t('ready')}</p>
              </div>
              <button onClick={() => {
                  setNewSessionData({
                      name: '',
                      date: new Date().toISOString().split('T')[0],
                      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                      observers: '',
                      lat: '',
                      lng: '',
                      type: 'trip',
                      temp: '',
                      cloud: '',
                      wind: '',
                      precip: ''
                  });
                  setView('new-session');
              }} className="bg-primary hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center">
                <Play size={18} fill="currentColor"/> {t('startBtn')}
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center rounded-t-2xl">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <ClipboardList size={16}/> {t('recent')}
                    </h3>
                    <div className="text-xs text-gray-400">{sessions.length} sessions</div>
                </div>
                
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {sessions.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                        {t('noSessions')}
                        </div>
                    ) : (
                        sessions.map(session => (
                        <div key={session.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all flex flex-col sm:flex-row justify-between items-center group cursor-pointer last:rounded-b-2xl gap-4 sm:gap-0" onClick={() => { setActiveSessionId(session.id); setView('active-session'); }}>
                            <div className="flex-1 w-full sm:w-auto">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h4 className="font-bold text-xl dark:text-white truncate max-w-[200px]">{session.name}</h4>
                                    
                                    {/* Status Badges */}
                                    {session.status === 'completed' ? (
                                        <span className="flex items-center gap-1 bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold dark:bg-green-900 dark:text-green-300 shadow-sm border border-green-200 dark:border-green-800">
                                           <CheckCircle size={10} className="stroke-[3]" /> FINISHED
                                        </span>
                                    ) : (
                                        <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                            ACTIVE
                                        </span>
                                    )}

                                    {/* Distinct Unsynced Badge */}
                                    {(!session.syncStatus || session.syncStatus !== 'synced') && (
                                        <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold dark:bg-yellow-900/40 dark:text-yellow-300 shadow-sm border border-yellow-200 dark:border-yellow-800">
                                            <CloudOff size={10} className="stroke-[3]" /> NOT SYNCED
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {session.date}</span>
                                    <span className="flex items-center gap-1"><Clock size={12}/> {session.startTime}</span>
                                    <span className="truncate max-w-[150px]"><User size={12} className="inline mr-1"/>{session.observers}</span>
                                </div>
                            </div>

                            {/* Prominent Stats & Type */}
                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-right">
                                    <div className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Type</div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded border ${session.type === 'counting' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' : 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'}`}>
                                        {session.type === 'counting' ? 'Migration' : 'Trip'}
                                    </span>
                                </div>

                                <div className="text-right">
                                    <div className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Birds</div>
                                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">
                                        {session.sightings.reduce((a,b)=>a+b.count,0)}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-1 pl-4 border-l border-gray-100 dark:border-slate-700">
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setExportMenuOpen(exportMenuOpen === session.id ? null : session.id); 
                                            }} 
                                            className={`p-2 rounded-lg transition-colors ${exportMenuOpen === session.id ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                            title="Download/Export"
                                        >
                                            <Download size={18}/>
                                        </button>
                                        {exportMenuOpen === session.id && (
                                            <div className="absolute top-full right-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in zoom-in-95">
                                                <button onClick={(e) => { e.stopPropagation(); handleDashboardDownload('csv', session); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"><Table size={14}/> CSV</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDashboardDownload('json', session); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"><FileJson size={14}/> JSON</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDashboardDownload('pdf', session); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"><FileText size={14}/> PDF</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDashboardDownload('text', session); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"><ClipboardList size={14}/> Copy</button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            startEditingSession(session);
                                        }}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" 
                                        title="Edit Metadata"
                                    >
                                        <Edit2 size={18} />
                                    </button>

                                    {user && session.syncStatus !== 'synced' && (
                                        <button onClick={(e) => { e.stopPropagation(); handleSyncSession(session); }} className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Sync to WordPress">
                                            <Cloud size={18} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if(confirm('Delete this session?')) {
                                                setSessions(prev => prev.filter(s => s.id !== session.id));
                                            }
                                        }} 
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete Session"
                                    >
                                        <Trash size={18}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                        ))
                    )}
                </div>
            </div>
          </div>
        )}
        
        {view === 'new-session' && (
          <div className="max-w-2xl mx-auto p-4 md:p-8 w-full pb-20">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold dark:text-white">{t('setupTitle')}</h2>
                    <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><X size={24} className="dark:text-white"/></button>
                </div>
                
                <form onSubmit={handleStartSession} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setNewSessionData({...newSessionData, type: 'trip'})} className={`p-4 rounded-xl border-2 text-center transition-all ${newSessionData.type === 'trip' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:text-gray-400'}`}>
                            <div className="font-bold">{t('tripMode')}</div>
                            <div className="text-xs opacity-70">{t('tripDesc')}</div>
                        </button>
                        <button type="button" onClick={() => setNewSessionData({...newSessionData, type: 'counting'})} className={`p-4 rounded-xl border-2 text-center transition-all ${newSessionData.type === 'counting' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:text-gray-400'}`}>
                            <div className="font-bold">{t('migMode')}</div>
                            <div className="text-xs opacity-70">{t('migDesc')}</div>
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('locName')}</label>
                        <input required placeholder="e.g. Richmond Park" className="w-full px-4 py-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-2 focus:ring-primary dark:text-white" value={newSessionData.name} onChange={e=>setNewSessionData({...newSessionData, name: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('date')}</label>
                            <input type="date" required className="w-full px-4 py-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600 outline-none dark:text-white" value={newSessionData.date} onChange={e=>setNewSessionData({...newSessionData, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('time')}</label>
                            <input type="time" required className="w-full px-4 py-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600 outline-none dark:text-white" value={newSessionData.startTime} onChange={e=>setNewSessionData({...newSessionData, startTime: e.target.value})} />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('observers')}</label>
                        <input placeholder="Names of counters..." className="w-full px-4 py-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600 outline-none dark:text-white" value={newSessionData.observers} onChange={e=>setNewSessionData({...newSessionData, observers: e.target.value})} />
                    </div>
                    
                     <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                         <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><MapPin size={14}/> GPS</label>
                            {gpsStatus === 'acquired' && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Acquired</span>
                            )}
                            {gpsStatus === 'locating' && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Loader2 size={8} className="animate-spin"/> Locating...</span>
                            )}
                            {gpsStatus === 'error' && (
                                <button type="button" onClick={fetchLocation} className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 hover:bg-red-200">
                                    Failed (Retry?)
                                </button>
                            )}
                         </div>
                        <div className="grid grid-cols-2 gap-3">
                             <div>
                                 <label className="text-[10px] text-gray-400 uppercase">Latitude</label>
                                 <input className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="0.000000" value={newSessionData.lat} onChange={e=>setNewSessionData({...newSessionData, lat: e.target.value})}/>
                             </div>
                             <div>
                                 <label className="text-[10px] text-gray-400 uppercase">Longitude</label>
                                 <input className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="0.000000" value={newSessionData.lng} onChange={e=>setNewSessionData({...newSessionData, lng: e.target.value})}/>
                             </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Cloud size={14}/> {t('weather')}</label>
                        <div className="grid grid-cols-2 gap-3">
                             <div>
                                 <label className="text-[10px] text-gray-400 uppercase">Temperature (°C)</label>
                                 <div className="relative">
                                     <Thermometer size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                                     <input className="w-full pl-7 pr-2 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="20" value={newSessionData.temp} onChange={e=>setNewSessionData({...newSessionData, temp: e.target.value})}/>
                                 </div>
                             </div>
                             <div>
                                 <label className="text-[10px] text-gray-400 uppercase">Cloud (%)</label>
                                 <div className="relative">
                                     <Cloud size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                                     <input className="w-full pl-7 pr-2 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="50" value={newSessionData.cloud} onChange={e=>setNewSessionData({...newSessionData, cloud: e.target.value})}/>
                                 </div>
                             </div>
                             <div>
                                 <label className="text-[10px] text-gray-400 uppercase">Wind (km/h)</label>
                                 <div className="relative">
                                     <Wind size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                                     <input className="w-full pl-7 pr-2 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="10 SW" value={newSessionData.wind} onChange={e=>setNewSessionData({...newSessionData, wind: e.target.value})}/>
                                 </div>
                             </div>
                             <div>
                                 <label className="text-[10px] text-gray-400 uppercase">Precipitation</label>
                                 <div className="relative">
                                     <Droplets size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                                     <input className="w-full pl-7 pr-2 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="None" value={newSessionData.precip} onChange={e=>setNewSessionData({...newSessionData, precip: e.target.value})}/>
                                 </div>
                             </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:bg-sky-600 transition-all active:scale-95 text-lg">{t('startCount')}</button>
                </form>
             </div>
          </div>
        )}

        {view === 'active-session' && (
            activeSession ? (
                <SessionView 
                    session={activeSession}
                    speciesList={settings.speciesList}
                    settings={settings}
                    onUpdateSession={s => setSessions(prev => prev.map(old => old.id === s.id ? s : old))}
                    onClose={() => {
                        setActiveSessionId(null);
                        setView('dashboard');
                    }}
                    onSync={handleSyncSession}
                    onReloadDefaults={handleReloadDefaults}
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[50vh]">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 dark:text-white">Session Not Found</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">The requested session could not be loaded. It may have been deleted or corrupted.</p>
                    <button onClick={() => { setActiveSessionId(null); setView('dashboard'); }} className="bg-primary hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95">
                        Return to Dashboard
                    </button>
                </div>
            )
        )}

        {view === 'settings' && (
          <SettingsPanel 
            settings={settings}
            onUpdateSettings={setSettings}
            onClose={() => setView('dashboard')}
          />
        )}
      </main>
      
      {/* Auto-Save Toast */}
      {showSaveToast && (
          <div className="fixed bottom-6 right-6 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300 z-[100]">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold">Data Auto-saved</span>
          </div>
      )}
      
      {/* ... Footer and Modals (About, Login, Restore) ... */}
      <footer className="bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 py-6 px-4 md:px-8">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-2">
                   <EagleLogo />
                   <span className="font-bold text-gray-700 dark:text-gray-300">OrniCount Pro</span>
               </div>
               <div className="flex items-center gap-6 text-sm text-gray-500">
                   <button onClick={(e) => { e.stopPropagation(); setShowAbout(true); }} className="hover:text-primary transition-colors">{t('about')}</button>
                   <button onClick={(e) => { e.stopPropagation(); window.open('https://birdsofiran.com', '_blank'); }} className="hover:text-primary transition-colors">{t('contact')}</button>
                   <span className="opacity-50">{t('version')}</span>
               </div>
          </div>
      </footer>
      
      {/* Editing Session Metadata Modal (Accessible from Dashboard) */}
      {editingSession && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold dark:text-white">Edit Session Details</h3>
                      <button onClick={() => setEditingSession(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('locName')}</label>
                          <input required className="w-full px-4 py-2 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('date')}</label>
                              <input type="date" required className="w-full px-4 py-2 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={editForm.date} onChange={e=>setEditForm({...editForm, date: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('time')}</label>
                              <input type="time" required className="w-full px-4 py-2 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={editForm.startTime} onChange={e=>setEditForm({...editForm, startTime: e.target.value})} />
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('observers')}</label>
                          <input className="w-full px-4 py-2 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={editForm.observers} onChange={e=>setEditForm({...editForm, observers: e.target.value})} />
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-3">{t('weather')}</label>
                          <div className="grid grid-cols-2 gap-3">
                               <div>
                                   <label className="text-[10px] text-gray-400 uppercase">Temp (°C)</label>
                                   <input className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editForm.temp} onChange={e=>setEditForm({...editForm, temp: e.target.value})}/>
                               </div>
                               <div>
                                   <label className="text-[10px] text-gray-400 uppercase">Cloud (%)</label>
                                   <input className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editForm.cloud} onChange={e=>setEditForm({...editForm, cloud: e.target.value})}/>
                               </div>
                               <div>
                                   <label className="text-[10px] text-gray-400 uppercase">Wind</label>
                                   <input className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editForm.wind} onChange={e=>setEditForm({...editForm, wind: e.target.value})}/>
                               </div>
                               <div>
                                   <label className="text-[10px] text-gray-400 uppercase">Precip</label>
                                   <input className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editForm.precip} onChange={e=>setEditForm({...editForm, precip: e.target.value})}/>
                               </div>
                          </div>
                      </div>

                      <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notes</label>
                           <textarea className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white h-24" value={editForm.notes} onChange={e=>setEditForm({...editForm, notes: e.target.value})} />
                      </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex gap-2">
                      <button onClick={() => setEditingSession(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                      <button onClick={saveEditedSession} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-sky-600">Save Changes</button>
                  </div>
              </div>
          </div>
      )}

      {showAbout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold dark:text-white">{t('aboutTitle')}</h3>
                    <button onClick={() => setShowAbout(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"><X size={20}/></button>
                </div>
                <div className="space-y-4 text-gray-600 dark:text-gray-300">
                    <p>OrniCount Pro is designed for professional ornithologists and serious birders. It supports both casual trip lists and rigorous migration counts.</p>
                    <p>Sync your data directly to <strong className="text-primary">BirdsOfIran.com</strong> to contribute to national databases.</p>
                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                        <p className="text-xs text-gray-400">Developed for Birds of Iran.</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                  <h3 className="text-xl font-bold mb-1 dark:text-white">{t('login')}</h3>
                  <p className="text-sm text-gray-500 mb-6">Connect to BirdsOfIran.com</p>
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('website')}</label>
                          <input required type="url" placeholder="https://birdsofiran.com" value={loginForm.websiteUrl} onChange={e=>setLoginForm({...loginForm, websiteUrl: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('username')}</label>
                          <input required type="text" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('appPass')}</label>
                          <input required type="password" placeholder="xxxx xxxx xxxx xxxx" value={loginForm.appPassword} onChange={e=>setLoginForm({...loginForm, appPassword: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm" />
                          <p className="text-[10px] text-gray-400 mt-1">Generate this in WP Admin &gt; Users &gt; Profile</p>
                      </div>

                      {authStatus === 'error' && <div className="p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-center gap-2"><AlertCircle size={12}/> Login failed. Check credentials.</div>}
                      {authStatus === 'success' && <div className="p-2 bg-green-50 text-green-600 text-xs rounded border border-green-100 flex items-center gap-2"><CheckCircle size={12}/> Success! Redirecting...</div>}

                      <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => setShowLogin(false)} className="flex-1 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                          <button type="submit" disabled={authStatus === 'loading'} className="flex-1 py-2 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-sky-600 flex items-center justify-center gap-2">
                              {authStatus === 'loading' && <Loader2 size={14} className="animate-spin"/>}
                              {t('login')}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {showRestorePrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-4 mx-auto">
                      <SettingsIcon size={24}/> 
                  </div>
                  <h3 className="text-xl font-bold text-center mb-2 dark:text-white">{t('restoreTitle')}</h3>
                  <p className="text-sm text-gray-500 text-center mb-6">{t('restoreMsg')}</p>
                  <div className="flex gap-2">
                      <button onClick={() => { 
                          setShowRestorePrompt(false); 
                          setActiveSessionId(null); 
                          localStorage.removeItem('orni_last_active_id');
                      }} className="flex-1 py-3 border border-gray-200 dark:border-slate-700 rounded-xl font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-gray-300">
                          {t('discardBtn')}
                      </button>
                      <button onClick={() => {
                          setActiveSessionId(pendingRestoreId);
                          setView('active-session');
                          setShowRestorePrompt(false);
                      }} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-sky-600">
                          {t('restoreBtn')}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;