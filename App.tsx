
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Car, Bike, LayoutGrid, List, Activity, Cpu, RefreshCw, Zap, Map as MapIcon, FolderOpen, LogOut, User, Wifi, WifiOff } from 'lucide-react';
import { ParkingSpot, ParkingStatus, VehicleType, ParkingStats, SpotLocation, MapZone, UserRole, WSMessage, AppStatePayload } from './types';
import { StatsCard } from './components/StatsCard';
import { SpotGrid } from './components/SpotGrid';
import { SpotTable } from './components/SpotTable';
import { MapView } from './components/MapView';
import { LayoutManager } from './components/LayoutManager';
import { LoginScreen } from './components/LoginScreen';
import { generateParkingInsights, simulateTrafficScenario } from './services/geminiService';

// Initialize spots
const INITIAL_CARS = 62;
const INITIAL_MOTOS = 31;

const generateSpots = (): ParkingSpot[] => {
  const spots: ParkingSpot[] = [];
  
  // Generate Cars
  for (let i = 1; i <= INITIAL_CARS; i++) {
    spots.push({
      id: `C-${i.toString().padStart(2, '0')}`,
      type: VehicleType.CAR,
      status: ParkingStatus.FREE,
      lastUpdated: new Date()
    });
  }
  
  // Generate Motos
  for (let i = 1; i <= INITIAL_MOTOS; i++) {
    spots.push({
      id: `M-${i.toString().padStart(2, '0')}`,
      type: VehicleType.MOTORCYCLE,
      status: ParkingStatus.FREE,
      lastUpdated: new Date()
    });
  }
  return spots;
};

// Local Storage Helper
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    // Handle date strings in JSON if needed, but for simplicity basic parse
    return item ? JSON.parse(item, (key, value) => {
        // Revive dates if the key suggests it
        if (key === 'lastUpdated') return new Date(value);
        return value;
    }) : fallback;
  } catch (e) {
    console.warn(`Failed to load ${key} from storage`, e);
    return fallback;
  }
};

const STORAGE_KEYS = {
    SPOTS: 'parking_spots',
    LOCATIONS: 'parking_spot_locations',
    ZONES: 'parking_map_zones',
    IMAGE: 'parking_map_image_data'
};

const WS_URL = 'ws://localhost:3001';

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  
  // State initialized from Storage for persistence across reloads/tabs
  const [spots, setSpots] = useState<ParkingSpot[]>(() => 
    loadFromStorage(STORAGE_KEYS.SPOTS, generateSpots())
  );
  
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'map' | 'layouts'>('grid');
  const [insight, setInsight] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  
  // Map State
  const [mapImage, setMapImage] = useState<string | null>(() => 
    localStorage.getItem(STORAGE_KEYS.IMAGE)
  );
  const [spotLocations, setSpotLocations] = useState<Record<string, SpotLocation>>(() => 
    loadFromStorage(STORAGE_KEYS.LOCATIONS, {})
  );
  const [zones, setZones] = useState<MapZone[]>(() => 
    loadFromStorage(STORAGE_KEYS.ZONES, [])
  );

  const isGuest = userRole === UserRole.GUEST;

  // --- WebSocket Connection ---
  useEffect(() => {
    // Dynamically determine WebSocket URL based on current protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // includes port if present
    const wsUrl = process.env.NODE_ENV === 'production' 
        ? `${protocol}//${host}` // In production, connect to same origin
        : WS_URL; // In dev, use localhost:3001

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to Server');
            setIsConnected(true);
            socketRef.current = ws;
        };

        ws.onmessage = (event) => {
            try {
                const message: WSMessage = JSON.parse(event.data, (key, value) => {
                    if (key === 'lastUpdated') return new Date(value);
                    return value;
                });

                if (message.type === 'INIT') {
                    // Only overwrite local state if server has valid data
                    if (message.payload.spots && message.payload.spots.length > 0) {
                        setSpots(message.payload.spots);
                        if (message.payload.spotLocations) setSpotLocations(message.payload.spotLocations);
                        if (message.payload.zones) setZones(message.payload.zones);
                        if (message.payload.mapImage) setMapImage(message.payload.mapImage);
                    } else {
                        // Server is empty, seed it with our local data
                        ws.send(JSON.stringify({
                            type: 'SYNC_INITIAL',
                            payload: {
                                spots: spots,
                                spotLocations: spotLocations,
                                zones: zones,
                                mapImage: mapImage
                            }
                        }));
                    }
                } else if (message.type === 'UPDATE') {
                    if (message.payload.spots) setSpots(message.payload.spots);
                    if (message.payload.spotLocations) setSpotLocations(message.payload.spotLocations);
                    if (message.payload.zones) setZones(message.payload.zones);
                    if (message.payload.mapImage) setMapImage(message.payload.mapImage);
                }
            } catch (e) {
                console.error('Failed to parse WS message', e);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from Server');
            setIsConnected(false);
            socketRef.current = null;
            // Try reconnecting in 3 seconds
            reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
            // Error handling usually handled by onclose
        };
    };

    connect();

    return () => {
        if (ws) ws.close();
        clearTimeout(reconnectTimeout);
    };
  }, []); // Run once on mount

  // Helper to send updates
  const broadcastUpdate = (payload: AppStatePayload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
            type: 'UPDATE',
            payload
        }));
    }
  };

  // --- LocalStorage Synchronization (Fallback / Offline) ---
  // Listens for changes in LocalStorage from other tabs (still useful if server is down or for same-machine sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        if (isConnected) return; // Ignore local storage events if we have a live server connection

        if (e.key === STORAGE_KEYS.SPOTS && e.newValue) {
            setSpots(JSON.parse(e.newValue, (k, v) => k === 'lastUpdated' ? new Date(v) : v));
        }
        if (e.key === STORAGE_KEYS.LOCATIONS && e.newValue) {
            setSpotLocations(JSON.parse(e.newValue));
        }
        if (e.key === STORAGE_KEYS.ZONES && e.newValue) {
            setZones(JSON.parse(e.newValue));
        }
        if (e.key === STORAGE_KEYS.IMAGE && e.newValue) {
            setMapImage(e.newValue);
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isConnected]);

  // Persist spots whenever they change (Auto-save for parking status)
  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.SPOTS, JSON.stringify(spots));
  }, [spots]);

  // Ensure View Mode resets to Map for guests if they were on restricted tabs
  useEffect(() => {
      if (userRole === UserRole.GUEST && viewMode === 'layouts') {
          setViewMode('map');
      }
  }, [userRole]);

  // Derived Statistics
  const stats: ParkingStats = useMemo(() => {
    const cars = spots.filter(s => s.type === VehicleType.CAR);
    const motos = spots.filter(s => s.type === VehicleType.MOTORCYCLE);
    
    const occupiedCars = cars.filter(s => s.status === ParkingStatus.OCCUPIED).length;
    const occupiedMotos = motos.filter(s => s.status === ParkingStatus.OCCUPIED).length;
    
    const totalOccupied = occupiedCars + occupiedMotos;
    const totalSpots = spots.length;
    
    return {
      totalCars: cars.length,
      occupiedCars,
      totalMotos: motos.length,
      occupiedMotos,
      occupancyRate: (totalOccupied / totalSpots) * 100
    };
  }, [spots]);

  const handleToggleSpot = (id: string) => {
    if (isGuest) return; // Prevent guests from toggling

    const newSpots = spots.map(spot => {
      if (spot.id === id) {
        return {
          ...spot,
          status: spot.status === ParkingStatus.FREE ? ParkingStatus.OCCUPIED : ParkingStatus.FREE,
          lastUpdated: new Date()
        };
      }
      return spot;
    });

    setSpots(newSpots);
    broadcastUpdate({ spots: newSpots });
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result = await generateParkingInsights(stats, spots);
    setInsight(result);
    setIsAnalyzing(false);
  };

  const handleSimulation = async (scenario: string) => {
    setIsSimulating(true);
    setShowSimModal(false);
    const newSpots = await simulateTrafficScenario(spots, scenario);
    setSpots(newSpots);
    broadcastUpdate({ spots: newSpots });
    setIsSimulating(false);
    
    // Auto analyze after simulation
    setTimeout(() => {
        handleAnalyze();
    }, 500);
  };
  
  const handleImageUpload = (file: File) => {
    if (isGuest) return;
    
    // Convert to Base64 to store in LocalStorage and send to Server
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result as string;
        try {
            localStorage.setItem(STORAGE_KEYS.IMAGE, base64String);
            setMapImage(base64String);
            broadcastUpdate({ mapImage: base64String });
        } catch (e) {
            alert("The selected image is too large to sync across tabs. Please choose a smaller image (under 5MB).");
        }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateLocation = (id: string, location: SpotLocation | null) => {
    if (isGuest) return;
    const newLocations = { ...spotLocations };
    
    if (location === null) {
        delete newLocations[id];
    } else {
        newLocations[id] = location;
    }
    
    setSpotLocations(newLocations);
    broadcastUpdate({ spotLocations: newLocations });
  };

  const handleAddZone = (zone: MapZone) => {
    if (isGuest) return;
    const newZones = [...zones, zone];
    setZones(newZones);
    broadcastUpdate({ zones: newZones });
  };

  const handleUpdateZone = (id: string, updates: Partial<MapZone>) => {
    if (isGuest) return;
    const newZones = zones.map(z => z.id === id ? { ...z, ...updates } : z);
    setZones(newZones);
    broadcastUpdate({ zones: newZones });
  };

  const handleDeleteZone = (id: string) => {
    if (isGuest) return;
    const newZones = zones.filter(z => z.id !== id);
    setZones(newZones);
    broadcastUpdate({ zones: newZones });
  };

  // Saves current locations/zones to "Active" state in LS
  // This triggers the 'storage' event in other tabs and updates server
  const handleQuickSaveLayout = () => {
    if (isGuest) return false;
    try {
      localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(spotLocations));
      localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(zones));
      
      // Also ensure server has the latest (redundant if already broadcasting, but good for explicit saves)
      broadcastUpdate({ spotLocations, zones });
      return true;
    } catch (e) {
      console.error("Failed to save layout", e);
      return false;
    }
  };

  // Loads a specific snapshot from the library
  const handleLoadLayoutSnapshot = (locations: Record<string, SpotLocation>, loadedZones: MapZone[]) => {
    setSpotLocations(locations);
    setZones(loadedZones);
    
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(locations));
    localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(loadedZones));
    broadcastUpdate({ spotLocations: locations, zones: loadedZones });
    
    setViewMode('map');
  };

  const carSpots = spots.filter(s => s.type === VehicleType.CAR);
  const motoSpots = spots.filter(s => s.type === VehicleType.MOTORCYCLE);

  // Render Login Screen if no role
  if (!userRole) {
      return <LoginScreen onLogin={setUserRole} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
      
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-lg backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Cpu className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-wide text-white hidden sm:block">Smart<span className="text-indigo-500">Park</span> Monitor</h1>
            {isGuest && <span className="sm:hidden text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded border border-emerald-800">Guest View</span>}
          </div>
          
          <div className="flex items-center gap-3">
             {/* Server Connection Status */}
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isConnected ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span className="hidden md:inline">{isConnected ? 'Server Online' : 'Offline Mode'}</span>
             </div>

            {/* Admin Controls */}
             {!isGuest && (
                 <button
                onClick={() => setShowSimModal(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-900/20 border border-amber-800/50 rounded-lg hover:bg-amber-900/40 transition-colors"
                >
                <Zap size={14} />
                Simulate
                </button>
             )}

            <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>

            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="Table View"
              >
                <List size={18} />
              </button>
              <button 
                onClick={() => setViewMode('map')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="Map View"
              >
                <MapIcon size={18} />
              </button>
              {!isGuest && (
                <button 
                    onClick={() => setViewMode('layouts')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'layouts' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Saved Layouts"
                >
                    <FolderOpen size={18} />
                </button>
              )}
            </div>
            
            <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>

            {/* Logout/Role Indicator */}
            <div className="flex items-center gap-2">
                <div className={`hidden sm:block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${isGuest ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' : 'bg-indigo-900/50 text-indigo-400 border border-indigo-800'}`}>
                    {isGuest ? 'Guest' : 'Admin'}
                </div>
                <button 
                    onClick={() => setUserRole(null)} 
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                    title="Logout"
                >
                    <LogOut size={18} />
                </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Row */}
        {viewMode !== 'layouts' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard 
                title="Total Occupancy" 
                value={`${stats.occupancyRate.toFixed(0)}%`}
                subValue={`${stats.occupiedCars + stats.occupiedMotos} / ${stats.totalCars + stats.totalMotos} Spots`}
                icon={Activity}
                colorClass="bg-indigo-500"
            />
            <StatsCard 
                title="Car Spaces" 
                value={stats.totalCars - stats.occupiedCars}
                subValue="Available Now"
                icon={Car}
                colorClass="bg-blue-500"
            />
            <StatsCard 
                title="Motorcycle Spaces" 
                value={stats.totalMotos - stats.occupiedMotos}
                subValue="Available Now"
                icon={Bike}
                colorClass="bg-orange-500"
            />
            
            {/* AI Insights Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-700/50 rounded-xl p-5 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Cpu size={80} />
                </div>
                <div className="flex justify-between items-start mb-2">
                <p className="text-indigo-300 text-sm font-medium">Gemini AI Insights</p>
                <button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing}
                    className="text-xs bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-200 px-2 py-1 rounded transition-colors flex items-center gap-1"
                >
                    {isAnalyzing ? <RefreshCw className="animate-spin" size={12}/> : <RefreshCw size={12}/>}
                    {isAnalyzing ? 'Analyzing...' : 'Refresh'}
                </button>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed min-h-[3rem]">
                {insight || "Click refresh to generate an AI analysis of the current parking situation."}
                </p>
            </div>
            </div>
        )}

        {/* Content Area */}
        {viewMode === 'grid' && (
          <div className="space-y-6 animate-fade-in">
            <SpotGrid 
              title="Car Parking Zone" 
              spots={carSpots} 
              onToggle={handleToggleSpot} 
              type={VehicleType.CAR}
              readOnly={isGuest}
            />
            <SpotGrid 
              title="Motorcycle Zone" 
              spots={motoSpots} 
              onToggle={handleToggleSpot} 
              type={VehicleType.MOTORCYCLE}
              readOnly={isGuest}
            />
          </div>
        )}

        {viewMode === 'table' && (
          <div className="animate-fade-in">
            <SpotTable spots={spots} onToggle={handleToggleSpot} readOnly={isGuest} />
          </div>
        )}
        
        {viewMode === 'map' && (
            <div className="animate-fade-in">
                <MapView 
                    spots={spots} 
                    spotLocations={spotLocations}
                    onUpdateLocation={handleUpdateLocation}
                    onToggleSpot={handleToggleSpot}
                    image={mapImage}
                    onUploadImage={handleImageUpload}
                    zones={zones}
                    onAddZone={handleAddZone}
                    onUpdateZone={handleUpdateZone}
                    onDeleteZone={handleDeleteZone}
                    onSave={handleQuickSaveLayout}
                    readOnly={isGuest}
                />
            </div>
        )}

        {viewMode === 'layouts' && !isGuest && (
            <LayoutManager 
                currentLocations={spotLocations}
                currentZones={zones}
                onLoadLayout={handleLoadLayoutSnapshot}
            />
        )}
      </main>

      {/* Simulation Modal */}
      {showSimModal && !isGuest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all scale-100">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="text-amber-400" /> Simulate Scenario
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                    Use Gemini AI to simulate realistic parking patterns based on a scenario description.
                </p>
                <div className="space-y-3">
                    <button 
                        onClick={() => handleSimulation("Early morning, mostly empty")}
                        className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex justify-between group"
                    >
                        <span className="text-slate-200">Early Morning</span>
                        <span className="text-slate-500 group-hover:text-slate-300">→</span>
                    </button>
                    <button 
                         onClick={() => handleSimulation("Morning rush hour, highly congested")}
                        className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex justify-between group"
                    >
                        <span className="text-slate-200">Rush Hour</span>
                        <span className="text-slate-500 group-hover:text-slate-300">→</span>
                    </button>
                    <button 
                         onClick={() => handleSimulation("Weekends, heavy motorcycle usage, moderate cars")}
                        className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex justify-between group"
                    >
                        <span className="text-slate-200">Weekend Biker Meetup</span>
                        <span className="text-slate-500 group-hover:text-slate-300">→</span>
                    </button>
                </div>
                <button 
                    onClick={() => setShowSimModal(false)}
                    className="mt-6 w-full py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
      )}

      {/* Loading Overlay for Simulation */}
      {isSimulating && (
        <div className="fixed inset-0 bg-slate-950/80 z-[60] flex flex-col items-center justify-center">
            <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <p className="text-xl font-semibold text-white">Simulating Scenario...</p>
            <p className="text-slate-400 text-sm mt-2">Gemini is arranging the vehicles.</p>
        </div>
      )}
    </div>
  );
};

export default App;
