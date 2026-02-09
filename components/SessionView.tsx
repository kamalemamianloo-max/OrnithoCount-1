import React, { useState, useMemo, useEffect } from 'react';
import { Session, Sighting, Species, Direction, Age, Sex, Morph, Distance, MigrationStatus, AppSettings } from '../types';
import { 
  Plus, Minus, Search, ArrowLeft, X, Save, 
  List, Edit2, Trash2, History, ChevronUp, ChevronDown, MessageSquare, 
  CheckCircle, AlertCircle, Loader2, FileText, FileJson, Table, 
  CheckSquare, Unlock, Info, MapPin, Share2, Clipboard, ExternalLink,
  Calendar, Clock, Trash, Cloud, ArrowUpRight, Download, Binoculars, Flag, RefreshCw
} from 'lucide-react';
import { generateCSV, generateJSON, generatePDF, generateTextSummary } from '../utils/exportUtils';

interface SessionViewProps {
  session: Session;
  speciesList: Species[];
  settings: AppSettings;
  onUpdateSession: (session: Session) => void;
  onClose: () => void;
  onSync: (session: Session) => void;
  onReloadDefaults: () => void;
}

const INITIAL_DETAIL = {
    count: 1,
    direction: 'S' as Direction,
    age: 'Unknown' as Age,
    sex: 'Unknown' as Sex,
    morph: 'Unknown' as Morph,
    distance: 'Unknown' as Distance,
    status: 'Active' as MigrationStatus,
    countType: 'Single',
    comment: ''
};

export const SessionView: React.FC<SessionViewProps> = ({ session, speciesList, settings, onUpdateSession, onClose, onSync, onReloadDefaults }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState(INITIAL_DETAIL);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showMoreDirs, setShowMoreDirs] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  
  // Session Details Editing
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoForm, setInfoForm] = useState({
      name: session.name,
      observers: session.observers,
      notes: session.notes || ''
  });
  
  // Editing State
  const [editingSighting, setEditingSighting] = useState<Sighting | null>(null);
  const [editTimeStr, setEditTimeStr] = useState('');

  // Status check
  const isCompleted = session.status === 'completed';

  // Helper: Count for species
  const getCountForSpecies = (id: string) => {
    return session.sightings
      .filter(s => s.speciesId === id)
      .reduce((acc, curr) => acc + curr.count, 0);
  };

  // --- SORTING LOGIC ---
  const filteredAndSortedSpecies = useMemo(() => {
    const safeList = speciesList || []; // Safety check
    const filtered = safeList.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.abbreviation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.family && s.family.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return [...filtered].sort((a, b) => {
      const aCount = getCountForSpecies(a.id);
      const bCount = getCountForSpecies(b.id);
      if (aCount > 0 && bCount === 0) return -1;
      if (bCount > 0 && aCount === 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [speciesList, searchTerm, session.sightings]);

  // --- HANDLERS ---

  const handleStartEdit = (s: Sighting) => {
    setEditingSighting(s);
    const d = new Date(s.timestamp);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    setEditTimeStr(`${h}:${m}`);
  };

  const handleSaveEdit = () => {
    if (!editingSighting) return;
    
    let updatedTimestamp = editingSighting.timestamp;
    if (editTimeStr) {
       const [h, m] = editTimeStr.split(':').map(Number);
       if (!isNaN(h) && !isNaN(m)) {
         const d = new Date(editingSighting.timestamp);
         d.setHours(h);
         d.setMinutes(m);
         updatedTimestamp = d.toISOString();
       }
    }

    onUpdateSession({
      ...session,
      sightings: session.sightings.map(s => s.id === editingSighting.id ? { ...editingSighting, timestamp: updatedTimestamp } : s)
    });
    setEditingSighting(null);
  };

  const handleToggleFinish = () => {
    // Only called when NOT completed, because the button is hidden in report view
    if (confirm("Finish session and view report?")) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      onUpdateSession({
        ...session,
        status: 'completed',
        endTime: now
      });
    }
  };

  const handleSaveInfo = () => {
      onUpdateSession({
          ...session,
          name: infoForm.name,
          observers: infoForm.observers,
          notes: infoForm.notes
      });
      setShowInfoModal(false);
  };

  // --- SIGHTING LOGIC ---
  const addSighting = (data: Partial<Sighting> & { speciesId: string, count: number }) => {
    if (isCompleted) {
        alert("Session is finished. Re-open to add counts.");
        return;
    }
    const now = new Date().toISOString();
    const newSighting: Sighting = {
      id: Date.now().toString() + Math.random().toString().slice(2, 5),
      timestamp: now,
      latitude: session.latitude,
      longitude: session.longitude,
      ...data
    };
    onUpdateSession({
      ...session,
      sightings: [...session.sightings, newSighting]
    });
  };

  const handleSimpleIncrement = (speciesId: string, amount: number) => {
    const current = getCountForSpecies(speciesId);
    if (amount < 0 && current <= 0) return;
    addSighting({ speciesId, count: amount });
  };

  const handleMigrationSelect = (id: string) => {
      if (isCompleted) {
          alert("Session is finished. Re-open to add counts.");
          return;
      }
      setSelectedSpeciesId(id);
      setDetailEntry({...INITIAL_DETAIL, count: 1});
      setIsControlsCollapsed(false); // Auto expand on selection
  };

  const handleMigrationSave = () => {
      if (!selectedSpeciesId) return;
      addSighting({
          speciesId: selectedSpeciesId,
          ...detailEntry
      });
  };

  const handleRecordDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    if (confirm("Are you sure you want to delete this record?")) {
        onUpdateSession({
            ...session,
            sightings: session.sightings.filter(s => s.id !== id)
        });
    }
  };

  // --- EXPORT HANDLERS ---
  const handleExportCSV = () => generateCSV(session, speciesList);
  const handleExportJSON = () => generateJSON(session);
  const handleExportPDF = () => generatePDF(session, speciesList);
  const handleExportText = () => {
      const text = generateTextSummary(session, speciesList);
      navigator.clipboard.writeText(text);
      alert("Summary copied to clipboard!");
  };

  // --- RENDER HELPERS ---
  const renderEditForm = () => {
      if (!editingSighting) return null;
      const sp = speciesList.find(s => s.id === editingSighting.speciesId);

      return (
          <div className="flex flex-col h-[80vh] overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0 p-4 border-b border-gray-100 dark:border-slate-800">
                  <div>
                      <div className="font-bold text-lg dark:text-white">Edit Record</div>
                      <div className="text-sm text-gray-500">{sp?.name}</div>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                      <Clock size={16} className="text-gray-400 ml-2"/>
                      <input type="time" value={editTimeStr} onChange={(e) => setEditTimeStr(e.target.value)} className="bg-transparent border-none outline-none text-sm font-bold w-20 text-center dark:text-white"/>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Count */}
                  <div className="flex items-center justify-center gap-4 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl">
                      <button onClick={() => setEditingSighting({...editingSighting, count: Math.max(1, editingSighting.count - 1)})} className="w-12 h-12 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center dark:text-white"><Minus/></button>
                      <input type="number" value={editingSighting.count} onChange={(e) => setEditingSighting({...editingSighting, count: parseInt(e.target.value)||1})} className="w-20 text-center text-3xl font-black bg-transparent outline-none dark:text-white"/>
                      <button onClick={() => setEditingSighting({...editingSighting, count: editingSighting.count + 1})} className="w-12 h-12 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center dark:text-white"><Plus/></button>
                  </div>

                  {/* Attributes */}
                  <div className="space-y-6">
                      {settings.fields.direction && (
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-400 uppercase">Direction</label>
                              <div className="flex flex-wrap gap-2">
                                  {settings.codes.direction.map(d => (
                                      <button key={d} onClick={() => setEditingSighting({...editingSighting, direction: d as Direction})} className={`px-3 py-1.5 rounded text-xs font-bold border ${editingSighting.direction === d ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 dark:text-white'}`}>{d}</button>
                                  ))}
                              </div>
                          </div>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {settings.fields.age && (
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-400 uppercase">Age</label>
                                  <div className="flex flex-wrap gap-2">
                                      {settings.codes.age.map(a => (
                                          <button key={a} onClick={() => setEditingSighting({...editingSighting, age: a as Age})} className={`px-3 py-1.5 rounded text-xs font-bold border ${editingSighting.age === a ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 dark:text-white'}`}>{a}</button>
                                      ))}
                                  </div>
                              </div>
                          )}
                           {settings.fields.sex && (
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-400 uppercase">Sex</label>
                                  <div className="flex flex-wrap gap-2">
                                      {settings.codes.sex.map(s => (
                                          <button key={s} onClick={() => setEditingSighting({...editingSighting, sex: s as Sex})} className={`px-3 py-1.5 rounded text-xs font-bold border ${editingSighting.sex === s ? 'bg-pink-500 text-white border-pink-500' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 dark:text-white'}`}>{s}</button>
                                      ))}
                                  </div>
                              </div>
                          )}
                           {settings.fields.morph && (
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-400 uppercase">Morph</label>
                                  <div className="flex flex-wrap gap-2">
                                      {settings.codes.morph.map(m => (
                                          <button key={m} onClick={() => setEditingSighting({...editingSighting, morph: m as Morph})} className={`px-3 py-1.5 rounded text-xs font-bold border ${editingSighting.morph === m ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 dark:text-white'}`}>{m}</button>
                                      ))}
                                  </div>
                              </div>
                          )}
                           {settings.fields.distance && (
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-400 uppercase">Distance</label>
                                  <div className="flex flex-wrap gap-2">
                                      {settings.codes.distance.map(d => (
                                          <button key={d} onClick={() => setEditingSighting({...editingSighting, distance: d as Distance})} className={`px-3 py-1.5 rounded text-xs font-bold border ${editingSighting.distance === d ? 'bg-slate-600 text-white border-slate-600' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 dark:text-white'}`}>{d}</button>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <textarea 
                      value={editingSighting.comment || ''} 
                      onChange={(e) => setEditingSighting({...editingSighting, comment: e.target.value})} 
                      placeholder="Add comments..." 
                      className="w-full p-3 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-sm"
                      rows={3}
                  />
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-slate-800 mt-auto flex gap-3 bg-white dark:bg-slate-900">
                  <button onClick={() => setEditingSighting(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                  <button onClick={handleSaveEdit} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-sky-600">Save Changes</button>
              </div>
          </div>
      );
  };


  const renderMigrationControls = () => {
      if (!selectedSpeciesId) return null;
      const sp = speciesList.find(s => s.id === selectedSpeciesId);
      const primaryDirs = ['N', 'S', 'Local'];
      const secondaryDirs = settings.codes.direction.filter(d => !primaryDirs.includes(d));

      return (
          <div className="flex flex-col h-full overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0 border-b border-gray-100 dark:border-slate-800 pb-2">
                  <div className="overflow-hidden">
                    <div className="font-bold text-lg dark:text-white truncate">{sp?.name}</div>
                    <div className="text-xs font-mono bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded inline-block">{sp?.abbreviation}</div>
                  </div>
                  <button onClick={() => setSelectedSpeciesId(null)} className="p-1.5 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-500 dark:text-gray-300">
                      <X size={16}/>
                  </button>
              </div>

              <div className="flex gap-4 items-stretch mb-4 shrink-0">
                  <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-xl p-1 shrink-0 shadow-inner">
                      <button onClick={() => setDetailEntry(p => ({...p, count: Math.max(1, p.count - 1)}))} className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"><Minus/></button>
                      <input type="number" value={detailEntry.count} onChange={e => setDetailEntry(p => ({...p, count: parseInt(e.target.value)||1}))} className="w-16 text-center text-xl font-bold bg-transparent dark:text-white outline-none"/>
                      <button onClick={() => setDetailEntry(p => ({...p, count: p.count + 1}))} className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"><Plus/></button>
                  </div>
                  
                  <div className="flex-1 flex flex-wrap gap-2 items-center justify-end">
                       {primaryDirs.map(d => (
                           <button key={d} onClick={() => setDetailEntry(p => ({...p, direction: d as Direction}))} className={`flex-1 min-w-[3rem] h-12 rounded-xl font-bold text-sm transition-all shadow-sm ${detailEntry.direction === d ? 'bg-primary text-white shadow-primary/30 ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200'}`}>{d}</button>
                       ))}
                       {secondaryDirs.length > 0 && (
                           <button onClick={() => setShowMoreDirs(!showMoreDirs)} className={`w-12 h-12 rounded-xl flex items-center justify-center border border-gray-200 dark:border-slate-600 ${showMoreDirs ? 'bg-gray-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'}`}><ArrowUpRight size={20}/></button>
                       )}
                  </div>
              </div>
              
              {showMoreDirs && (
                  <div className="mb-4 grid grid-cols-5 gap-2 animate-in slide-in-from-top-2">
                       {secondaryDirs.map(d => (
                           <button key={d} onClick={() => setDetailEntry(p => ({...p, direction: d as Direction}))} className={`h-10 rounded-lg font-bold text-xs transition-all ${detailEntry.direction === d ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700'}`}>{d}</button>
                       ))}
                  </div>
              )}
              
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
                  {settings.fields.age && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase text-center border-b border-gray-100 dark:border-slate-800 pb-1">Age</div>
                        {settings.codes.age.map(c => (
                            <button key={c} onClick={() => setDetailEntry(p => ({...p, age: c as Age}))} className={`w-full h-10 rounded-lg font-bold text-xs transition-all shadow-sm ${detailEntry.age === c ? 'bg-indigo-500 text-white ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200'}`}>{c}</button>
                        ))}
                      </div>
                  )}
                  {settings.fields.sex && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase text-center border-b border-gray-100 dark:border-slate-800 pb-1">Sex</div>
                        {settings.codes.sex.map(c => (
                            <button key={c} onClick={() => setDetailEntry(p => ({...p, sex: c as Sex}))} className={`w-full h-10 rounded-lg font-bold text-xs transition-all shadow-sm ${detailEntry.sex === c ? 'bg-pink-500 text-white ring-2 ring-pink-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200'}`}>{c}</button>
                        ))}
                      </div>
                  )}
                   {settings.fields.morph && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase text-center border-b border-gray-100 dark:border-slate-800 pb-1">Morph</div>
                        {settings.codes.morph.map(c => (
                            <button key={c} onClick={() => setDetailEntry(p => ({...p, morph: c as Morph}))} className={`w-full h-10 rounded-lg font-bold text-xs transition-all shadow-sm ${detailEntry.morph === c ? 'bg-amber-500 text-white ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-gray-200'}`}>{c}</button>
                        ))}
                      </div>
                  )}
                  {settings.fields.distance && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase text-center border-b border-gray-100 dark:border-slate-800 pb-1">Dist</div>
                        {settings.codes.distance.map(c => (
                            <button key={c} onClick={() => setDetailEntry(p => ({...p, distance: c as Distance}))} className={`w-full h-10 rounded-lg font-bold text-xs border transition-all ${detailEntry.distance === c ? 'bg-slate-600 text-white border-slate-600' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 dark:text-gray-300'}`}>{c}</button>
                        ))}
                      </div>
                  )}
                </div>

                  <div className="pt-4 mt-2">
                    <button onClick={() => setShowExtras(!showExtras)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <span>Details (Count Type, Status, Comments)</span>
                        {showExtras ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                    {showExtras && (
                        <div className="mt-3 space-y-4 p-2 bg-gray-50/50 dark:bg-slate-900/50 rounded-lg animate-in slide-in-from-top-2">
                            {settings.fields.countType && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Count Type</label>
                                    <div className="flex flex-wrap gap-2">
                                        {settings.codes.countType.map(ct => (
                                            <button key={ct} onClick={() => setDetailEntry(p => ({...p, countType: ct}))} className={`px-3 py-1.5 rounded-md font-bold text-xs border ${detailEntry.countType === ct ? 'bg-teal-500 text-white border-teal-500' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600'}`}>{ct}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Status</label>
                                <div className="flex flex-wrap gap-2">
                                    {settings.codes.status.map(s => (
                                        <button key={s} onClick={() => setDetailEntry(p => ({...p, status: s as MigrationStatus}))} className={`px-3 py-1.5 rounded-md font-bold text-xs border ${detailEntry.status === s ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600'}`}>{s}</button>
                                    ))}
                                </div>
                            </div>
                            <textarea value={detailEntry.comment} onChange={e => setDetailEntry(p => ({...p, comment: e.target.value}))} placeholder="Add comments..." className="w-full p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs outline-none" rows={2} />
                        </div>
                    )}
                  </div>
              </div>

              <div className="pt-3 mt-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur shrink-0 border-t border-gray-100 dark:border-slate-800 z-10">
                  <button onClick={handleMigrationSave} className="w-full h-14 bg-primary text-white text-lg font-bold rounded-xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-sky-600">
                      <Save size={20}/> Save Record
                  </button>
              </div>
          </div>
      );
  };

  const renderCountingUI = () => (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shrink-0">
         <div className="max-w-7xl mx-auto flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text"
                    placeholder="Search species..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:bg-white dark:focus:bg-slate-900 dark:text-white outline-none transition-all text-sm font-medium"
                />
            </div>
            
            <button onClick={handleToggleFinish} className={`px-4 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors ${isCompleted ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>
                {isCompleted ? <><CheckCircle size={16}/> Finished</> : <><Flag size={16}/> Finish</>}
            </button>

            <button onClick={() => setShowRecordsModal(true)} className="px-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-primary shadow-sm active:scale-95 transition-all">
                <History size={20} />
            </button>
         </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-2 md:p-4 bg-gray-50 dark:bg-slate-950 ${session.type === 'counting' ? (selectedSpeciesId ? (isControlsCollapsed ? 'pb-24' : 'pb-[85vh] md:pb-[65vh]') : '') : 'pb-24'}`}>
        <div className={`max-w-7xl mx-auto grid ${session.type === 'counting' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5'} gap-2 md:gap-3`}>
          {filteredAndSortedSpecies.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center text-center p-12 opacity-50">
               <div className="bg-gray-200 dark:bg-slate-800 p-6 rounded-full mb-4">
                  <Binoculars size={48} className="text-gray-400" />
               </div>
               <h3 className="text-xl font-bold dark:text-white">Where are the birds?</h3>
               <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                 {searchTerm ? `No matches for "${searchTerm}"` : "Your species list is empty."}
               </p>
               {!searchTerm && (
                   <button 
                    onClick={onReloadDefaults}
                    className="mt-4 flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-sky-600 transition-colors"
                   >
                       <RefreshCw size={16}/> Load Default Species
                   </button>
               )}
            </div>
          ) : (
             filteredAndSortedSpecies.map(sp => {
                const count = getCountForSpecies(sp.id);
                const isChosen = count > 0;
                const isSelected = selectedSpeciesId === sp.id;
                return (
                <div 
                    key={sp.id} 
                    onClick={() => {
                        if (session.type === 'counting') handleMigrationSelect(sp.id);
                        else handleSimpleIncrement(sp.id, 1);
                    }}
                    className={`p-2 md:p-3 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between h-24 md:h-28 overflow-hidden
                    ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md transform scale-[1.02]' : ''}
                    ${!isSelected && isChosen ? 'bg-white dark:bg-slate-800 border-primary ring-1 ring-primary/20 shadow-sm' : ''}
                    ${!isSelected && !isChosen ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-gray-300' : ''}
                    ${isCompleted ? 'opacity-80 grayscale-[0.5]' : ''}
                    `}
                >
                    <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isChosen ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                        {sp.abbreviation}
                    </span>
                    {isChosen && <span className="text-primary font-black text-lg md:text-xl">{count}</span>}
                    </div>
                    <div>
                        <h3 className={`text-xs md:text-sm leading-tight mt-1 truncate ${isChosen ? 'font-black text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-gray-300'}`}>
                        {sp.name}
                        </h3>
                        <div className="text-[9px] text-gray-400 truncate">{sp.family}</div>
                    </div>
                    {session.type === 'trip' && isChosen && !isCompleted && (
                        <div className="flex gap-1 mt-auto pt-1">
                            <button onClick={(e) => { e.stopPropagation(); handleSimpleIncrement(sp.id, -1); }} className="flex-1 py-1 bg-gray-100 dark:bg-slate-700 rounded flex justify-center hover:bg-red-50 hover:text-red-500 transition-colors"><Minus size={12} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleSimpleIncrement(sp.id, 1); }} className="flex-1 py-1 bg-primary text-white rounded flex justify-center hover:bg-sky-600 transition-colors"><Plus size={12} /></button>
                        </div>
                    )}
                </div>
                );
            })
          )}
        </div>
      </div>
      
      {session.type === 'counting' && selectedSpeciesId && (
        <div className={`fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out ${isControlsCollapsed ? 'h-20' : 'h-[80vh] md:h-[60vh]'}`}>
            {selectedSpeciesId && (
              <>
                <button 
                    onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 rounded-full p-1.5 shadow-sm z-50 hover:bg-gray-50 flex items-center justify-center w-8 h-8"
                >
                    {isControlsCollapsed ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
                <div className="max-w-4xl mx-auto h-full">
                    {isControlsCollapsed ? (
                         <div className="flex items-center justify-between px-4 h-full">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="font-bold text-lg dark:text-white truncate">
                                    {speciesList.find(s=>s.id===selectedSpeciesId)?.name}
                                </div>
                                <span className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">
                                    {speciesList.find(s=>s.id===selectedSpeciesId)?.abbreviation}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="font-mono text-xl font-black text-primary">
                                    {detailEntry.count}
                                </div>
                                <button onClick={(e) => {e.stopPropagation(); handleMigrationSave();}} className="bg-primary text-white p-2 rounded-lg shadow active:scale-95">
                                    <Save size={20}/>
                                </button>
                                <button onClick={(e) => {e.stopPropagation(); setSelectedSpeciesId(null);}} className="bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 p-2 rounded-lg shadow active:scale-95">
                                    <X size={20}/>
                                </button>
                            </div>
                         </div>
                    ) : (
                        <div className="p-4 h-full">
                            {renderMigrationControls()}
                        </div>
                    )}
                </div>
              </>
          )}
        </div>
      )}
    </div>
  );

  const renderReportUI = () => {
    const totalBirds = session.sightings.reduce((acc, s) => acc + s.count, 0);
    const uniqueSpecies = new Set(session.sightings.map(s => s.speciesId)).size;
    
    // Group sightings for display
    const speciesCounts: Record<string, number> = {};
    session.sightings.forEach(s => {
        speciesCounts[s.speciesId] = (speciesCounts[s.speciesId] || 0) + s.count;
    });
    const sortedSpecies = Object.entries(speciesCounts)
        .sort(([,a], [,b]) => b - a)
        .map(([id, count]) => {
            const sp = speciesList.find(s => s.id === id);
            return { name: sp?.name || 'Unknown', count, id };
        });

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900">
            {/* Header */}
            <div className="p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-bold dark:text-white">Session Report</h2>
                    <p className="text-sm text-gray-500">{session.name} • {session.date}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500">
                    <X size={24}/>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <div className="text-sm text-gray-500 uppercase font-bold">Total Birds</div>
                            <div className="text-3xl font-black text-primary">{totalBirds}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <div className="text-sm text-gray-500 uppercase font-bold">Species</div>
                            <div className="text-3xl font-black text-indigo-500">{uniqueSpecies}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                             <div className="text-sm text-gray-500 uppercase font-bold">Duration</div>
                             <div className="text-xl font-bold dark:text-white mt-1">{session.startTime} - {session.endTime || 'Now'}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                             <div className="text-sm text-gray-500 uppercase font-bold">Observers</div>
                             <div className="text-sm font-bold dark:text-white mt-1 truncate" title={session.observers}>{session.observers}</div>
                        </div>
                    </div>

                    {/* Export Actions */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <button onClick={handleExportCSV} className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            <Table className="text-green-600"/> <span className="text-xs font-bold dark:text-gray-300">CSV</span>
                        </button>
                         <button onClick={handleExportJSON} className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            <FileJson className="text-orange-600"/> <span className="text-xs font-bold dark:text-gray-300">JSON</span>
                        </button>
                         <button onClick={handleExportPDF} className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            <FileText className="text-red-600"/> <span className="text-xs font-bold dark:text-gray-300">PDF</span>
                        </button>
                        <button onClick={handleExportText} className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            <Clipboard className="text-blue-600"/> <span className="text-xs font-bold dark:text-gray-300">Copy Text</span>
                        </button>
                    </div>

                    {/* Species List */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                            <h3 className="font-bold dark:text-white">Species Breakdown</h3>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-slate-700">
                            {sortedSpecies.map(item => (
                                <div key={item.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                    <span className="font-medium dark:text-gray-200">{item.name}</span>
                                    <span className="font-bold font-mono text-slate-700 dark:text-white">{item.count}</span>
                                </div>
                            ))}
                            {sortedSpecies.length === 0 && <div className="p-8 text-center text-gray-400">No birds recorded.</div>}
                        </div>
                    </div>

                     {/* Action Footer */}
                     <div className="flex gap-4 pt-4">
                        <button onClick={() => onUpdateSession({ ...session, status: 'active' })} className="flex-1 py-3 border border-gray-300 dark:border-slate-600 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700">
                            Resume Counting
                        </button>
                        <button onClick={onClose} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-sky-600">
                            Back to Dashboard
                        </button>
                     </div>

                </div>
            </div>
        </div>
    );
  };

  if (isCompleted) {
      return renderReportUI();
  }

  return (
      <>
       {renderCountingUI()}
       
       {editingSighting && (
           <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={() => setEditingSighting(null)}>
               <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl overflow-hidden shadow-2xl h-[85vh] sm:h-auto" onClick={e => e.stopPropagation()}>
                   {renderEditForm()}
               </div>
           </div>
       )}

       {showRecordsModal && (
           <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRecordsModal(false)}>
               <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                   <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
                       <h3 className="font-bold text-lg dark:text-white">Session History</h3>
                       <button onClick={() => setShowRecordsModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"><X/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4">
                       <table className="w-full text-sm text-left">
                           <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-slate-800 uppercase">
                               <tr>
                                   <th className="px-3 py-2">Time</th>
                                   <th className="px-3 py-2">Species</th>
                                   <th className="px-3 py-2 text-right">Count</th>
                                   <th className="px-3 py-2"></th>
                                </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                               {session.sightings.slice().reverse().map(s => {
                                   const sp = speciesList.find(x => x.id === s.speciesId);
                                   return (
                                       <tr key={s.id}>
                                           <td className="px-3 py-2 text-gray-500">{new Date(s.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                           <td className="px-3 py-2 font-medium dark:text-white">
                                               {sp?.name}
                                               {s.direction && <span className="ml-2 text-[10px] bg-gray-100 dark:bg-slate-700 px-1 rounded border dark:border-slate-600">{s.direction}</span>}
                                           </td>
                                           <td className="px-3 py-2 text-right font-bold dark:text-white">{s.count}</td>
                                           <td className="px-3 py-2 text-right flex justify-end gap-1">
                                               <button onClick={() => { setShowRecordsModal(false); handleStartEdit(s); }} className="p-1 hover:text-primary rounded hover:bg-primary/10 transition-colors"><Edit2 size={14}/></button>
                                               <button onClick={(e) => handleRecordDelete(e, s.id)} className="p-1 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14}/></button>
                                           </td>
                                       </tr>
                                   );
                               })}
                               {session.sightings.length === 0 && (
                                   <tr><td colSpan={4} className="p-4 text-center text-gray-400">No records yet.</td></tr>
                               )}
                           </tbody>
                       </table>
                   </div>
               </div>
           </div>
       )}
      </>
  );
};