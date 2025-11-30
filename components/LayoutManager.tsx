import React, { useState, useEffect } from 'react';
import { LayoutSnapshot, MapZone, SpotLocation } from '../types';
import { Save, FolderOpen, Trash2, Clock, Map as MapIcon, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

interface LayoutManagerProps {
  currentLocations: Record<string, SpotLocation>;
  currentZones: MapZone[];
  onLoadLayout: (locations: Record<string, SpotLocation>, zones: MapZone[]) => void;
}

const STORAGE_KEY = 'parking_layout_snapshots';

export const LayoutManager: React.FC<LayoutManagerProps> = ({ 
  currentLocations, 
  currentZones, 
  onLoadLayout 
}) => {
  const [snapshots, setSnapshots] = useState<LayoutSnapshot[]>([]);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSnapshots(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load snapshots", e);
    }
  };

  const handleSaveNew = () => {
    if (!newLayoutName.trim()) return;

    const newSnapshot: LayoutSnapshot = {
      id: crypto.randomUUID(),
      name: newLayoutName,
      date: Date.now(),
      spotLocations: currentLocations,
      zones: currentZones
    };

    const updated = [newSnapshot, ...snapshots];
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSnapshots(updated);
      setNewLayoutName('');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      console.error("Failed to save snapshot", e);
      setSaveStatus('error');
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this layout?')) return;
    
    const updated = snapshots.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSnapshots(updated);
  };

  const handleLoad = (snapshot: LayoutSnapshot) => {
    if (confirm(`Load layout "${snapshot.name}"? This will replace your current map configuration.`)) {
      onLoadLayout(snapshot.spotLocations, snapshot.zones);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Layout Library</h2>
        <p className="text-slate-400">Manage multiple parking configurations. Save your current workspace or switch between different setups.</p>
      </div>

      {/* Save Current Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
            <Save size={120} />
        </div>
        
        <div className="relative z-10">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="text-emerald-400" />
                Create New Snapshot
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-2xl">
                Save the currently active map markers ({Object.keys(currentLocations).length} spots) and zones ({currentZones.length} zones) as a new reusable layout.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <input 
                    type="text" 
                    placeholder="Enter layout name (e.g., 'Level B1 - Weekday')"
                    value={newLayoutName}
                    onChange={(e) => setNewLayoutName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
                <button
                    onClick={handleSaveNew}
                    disabled={!newLayoutName.trim()}
                    className={`
                        px-6 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg
                        ${newLayoutName.trim() 
                            ? 'bg-emerald-600 hover:bg-emerald-500 hover:translate-y-[-2px]' 
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
                    `}
                >
                    {saveStatus === 'success' ? <CheckCircle2 /> : <Save />}
                    {saveStatus === 'success' ? 'Saved!' : 'Save Snapshot'}
                </button>
            </div>
            
            {saveStatus === 'error' && (
                <p className="mt-3 text-rose-400 text-sm flex items-center gap-2">
                    <AlertCircle size={14} /> Failed to save. Local storage might be full.
                </p>
            )}
        </div>
      </div>

      {/* Saved Layouts List */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FolderOpen className="text-indigo-400" />
            Saved Layouts ({snapshots.length})
        </h3>

        {snapshots.length === 0 ? (
            <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="text-slate-600" size={32} />
                </div>
                <h4 className="text-slate-300 font-medium mb-1">No layouts saved yet</h4>
                <p className="text-slate-500 text-sm">Save your current configuration above to get started.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {snapshots.map(layout => (
                    <div 
                        key={layout.id} 
                        className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-indigo-500/50 transition-all group relative"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-bold text-white text-lg group-hover:text-indigo-300 transition-colors">
                                    {layout.name}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                    <Clock size={12} />
                                    {new Date(layout.date).toLocaleDateString()} at {new Date(layout.date).toLocaleTimeString()}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleLoad(layout)}
                                    className="p-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors"
                                    title="Load Layout"
                                >
                                    <FolderOpen size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(layout.id)}
                                    className="p-2 bg-slate-700/50 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-colors"
                                    title="Delete Layout"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 py-3 border-t border-slate-700/50 mt-3">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <MapIcon size={16} className="text-amber-400" />
                                <span>{Object.keys(layout.spotLocations).length} <span className="text-slate-500">Spots</span></span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <div className="w-4 h-4 border-2 border-dashed border-purple-400 rounded bg-purple-400/20"></div>
                                <span>{layout.zones.length} <span className="text-slate-500">Zones</span></span>
                            </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-500 italic">
                            * Loading this will require the matching floor plan image.
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};
