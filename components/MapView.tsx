
import React, { useState, useRef, useEffect } from 'react';
import { ParkingSpot, ParkingStatus, VehicleType, SpotLocation, MapZone } from '../types';
import { Upload, Map as MapIcon, Lock, Unlock, Car, Bike, MousePointer2, ZoomIn, ZoomOut, RotateCcw, CheckCircle2, Move, SquareDashed, Trash2, Tag, Save, Eye } from 'lucide-react';

interface MapViewProps {
  spots: ParkingSpot[];
  spotLocations: Record<string, SpotLocation>;
  onUpdateLocation: (id: string, location: SpotLocation | null) => void;
  onToggleSpot: (id: string) => void;
  image: string | null;
  onUploadImage: (file: File) => void;
  zones: MapZone[];
  onAddZone: (zone: MapZone) => void;
  onUpdateZone: (id: string, updates: Partial<MapZone>) => void;
  onDeleteZone: (id: string) => void;
  onSave: () => boolean;
  readOnly?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({ 
  spots, 
  spotLocations, 
  onUpdateLocation, 
  onToggleSpot, 
  image, 
  onUploadImage,
  zones,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  onSave,
  readOnly = false
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  
  // Drawing Mode
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [activeDrawRect, setActiveDrawRect] = useState<{start: {x: number, y: number}, current: {x: number, y: number}} | null>(null);

  // Zoom & Pan State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const clickStartPosRef = useRef<{ x: number, y: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Filter spots into unmapped and mapped for the sidebar
  const unmappedSpots = spots.filter(s => !spotLocations[s.id]);
  
  // Auto-select the first unmapped spot when entering edit mode
  useEffect(() => {
    if (isEditMode && !selectedSpotId && unmappedSpots.length > 0 && !isDrawingZone) {
      setSelectedSpotId(unmappedSpots[0].id);
    }
  }, [isEditMode, unmappedSpots.length, selectedSpotId, isDrawingZone]);

  // Reset transform when image changes
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [image]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(e.target.files[0]);
    }
  };

  const handleSave = () => {
    const success = onSave();
    if (success) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  // Zoom Handlers
  const handleZoomIn = () => setTransform(p => ({ ...p, scale: Math.min(p.scale + 0.5, 8) }));
  const handleZoomOut = () => setTransform(p => ({ ...p, scale: Math.max(p.scale - 0.5, 0.5) }));
  const handleResetZoom = () => setTransform({ x: 0, y: 0, scale: 1 });

  const handleWheel = (e: React.WheelEvent) => {
    if (!image) return;
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newScale = Math.min(Math.max(transform.scale + delta, 0.5), 8);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  // Pan / Drag / Draw Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image || e.button !== 0) return; 

    // 1. Drawing Zone Logic
    if (isDrawingZone && isEditMode && mapContainerRef.current) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = mapContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        setActiveDrawRect({
            start: { x, y },
            current: { x, y }
        });
        return;
    }

    // 2. Dragging Logic
    // If clicking a marker, propagation should have been stopped by handleMarkerMouseDown if in edit mode.
    if ((e.target as HTMLElement).closest('[data-marker="true"]')) {
       clickStartPosRef.current = { x: e.clientX, y: e.clientY };
    }

    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    clickStartPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Zone Drawing Update
    if (isDrawingZone && activeDrawRect && mapContainerRef.current) {
        e.preventDefault();
        const rect = mapContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        setActiveDrawRect(prev => prev ? { ...prev, current: { x, y } } : null);
        return;
    }

    // 2. Marker Dragging (Edit Mode)
    if (draggingMarkerId && isEditMode && mapContainerRef.current) {
      e.preventDefault();
      const rect = mapContainerRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      onUpdateLocation(draggingMarkerId, { x, y });
      return; 
    }

    // 3. Map Panning
    if (!isDragging || !dragStartRef.current) return;
    e.preventDefault();
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    setTransform(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = () => {
    // 1. Finish Drawing Zone
    if (isDrawingZone && activeDrawRect) {
        const { start, current } = activeDrawRect;
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);
        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        
        // Only add if it has some size
        if (width > 1 && height > 1) {
            onAddZone({
                id: `zone-${Date.now()}`,
                label: 'New Zone',
                x, y, width, height,
                color: 'bg-indigo-500',
                type: 'default'
            });
        }
        setActiveDrawRect(null);
        setIsDrawingZone(false);
    }

    setIsDragging(false);
    setDraggingMarkerId(null);
    dragStartRef.current = null;
  };

  // Map Interaction
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (clickStartPosRef.current) {
        const dist = Math.sqrt(Math.pow(e.clientX - clickStartPosRef.current.x, 2) + Math.pow(e.clientY - clickStartPosRef.current.y, 2));
        if (dist > 5) return;
    }

    if (!isEditMode || !mapContainerRef.current || isDrawingZone) return;
    
    if ((e.target as HTMLElement).closest('[data-marker="true"]')) return;

    if (selectedSpotId) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      onUpdateLocation(selectedSpotId, { x, y });
      setSelectedSpotId(null);
    }
  };

  const handleMarkerMouseDown = (e: React.MouseEvent, spotId: string) => {
    if (!isEditMode || isDrawingZone || readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingMarkerId(spotId);
    setSelectedSpotId(spotId);
  };

  const handleMarkerClick = (e: React.MouseEvent, spotId: string) => {
    e.stopPropagation();
    if (clickStartPosRef.current) {
        const dist = Math.sqrt(Math.pow(e.clientX - clickStartPosRef.current.x, 2) + Math.pow(e.clientY - clickStartPosRef.current.y, 2));
        if (dist > 5) return;
    }
    if (readOnly) return; 

    if (isEditMode) {
        if (!isDrawingZone) setSelectedSpotId(spotId);
    } else {
        onToggleSpot(spotId);
    }
  };

  const handleMarkerRightClick = (e: React.MouseEvent, spotId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (isEditMode && !readOnly) {
          onUpdateLocation(spotId, null);
      }
  };

  const activeSpot = spots.find(s => s.id === selectedSpotId);

  // Helper to render temp draw rect
  const renderDrawRect = () => {
    if (!activeDrawRect) return null;
    const { start, current } = activeDrawRect;
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);

    return (
        <div 
            className="absolute border-2 border-indigo-400 bg-indigo-500/20 z-20 pointer-events-none"
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
        />
    );
  };

  // Helper to get zone color
  const getZoneColor = (colorClass: string) => {
      if (colorClass.includes('indigo')) return { bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', text: 'text-indigo-200' };
      if (colorClass.includes('orange')) return { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-200' };
      if (colorClass.includes('rose')) return { bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-200' };
      if (colorClass.includes('purple')) return { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-200' };
      return { bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-200' };
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-12rem)] gap-6 animate-fade-in">
      
      {/* Main Map Area */}
      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl relative flex flex-col overflow-hidden group">
        {image ? (
          <div className="relative flex-1 w-full h-full bg-slate-900 overflow-hidden">
             
             {/* Map Status Indicators */}
             <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none transition-opacity duration-300">
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 shadow-lg flex items-center gap-2">
                   <ZoomIn size={14} className="text-indigo-400"/>
                   <span>Zoom: {Math.round(transform.scale * 100)}%</span>
                </div>
                <div className={`
                    bg-indigo-600/90 backdrop-blur-md border border-indigo-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-lg flex items-center gap-2 transition-all duration-200
                    ${isDragging && !draggingMarkerId ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
                `}>
                   <Move size={14} />
                   <span>Panning</span>
                </div>
                {isDrawingZone && (
                     <div className="bg-purple-600/90 backdrop-blur-md border border-purple-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-left-4">
                     <SquareDashed size={14} />
                     <span>Drawing Zone</span>
                  </div>
                )}
                {readOnly && (
                    <div className="bg-emerald-600/90 backdrop-blur-md border border-emerald-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-lg flex items-center gap-2">
                        <Eye size={14} />
                        <span>View Only</span>
                    </div>
                )}
             </div>

            {/* Viewport & Interactions */}
            <div 
                className={`w-full h-full ${isDrawingZone ? 'cursor-crosshair' : (isDragging || draggingMarkerId) ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <div 
                    ref={mapContainerRef}
                    className="relative origin-center transition-transform duration-75 ease-out inline-block"
                    style={{ 
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        minWidth: '100%',
                        minHeight: '100%'
                    }}
                    onClick={handleMapClick}
                >
                    <img 
                        src={image} 
                        alt="Parking Map" 
                        draggable={false}
                        className="max-w-none pointer-events-none select-none" 
                        style={{ minWidth: '100%' }}
                    />

                    {/* Render Zones */}
                    {zones.map(zone => {
                        const style = getZoneColor(zone.color);
                        return (
                            <div
                                key={zone.id}
                                className={`absolute border-2 flex items-start justify-start p-1 ${style.bg} ${style.border}`}
                                style={{ 
                                    left: `${zone.x}%`, 
                                    top: `${zone.y}%`, 
                                    width: `${zone.width}%`, 
                                    height: `${zone.height}%` 
                                }}
                            >
                                <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide px-1 rounded bg-slate-900/40 backdrop-blur-sm ${style.text}`}>
                                    {zone.label}
                                </span>
                            </div>
                        );
                    })}

                    {/* Temporary Drawing Rect */}
                    {renderDrawRect()}
                
                    {/* Markers Overlay */}
                    {spots.map(spot => {
                        const loc = spotLocations[spot.id];
                        if (!loc) return null;

                        const isOccupied = spot.status === ParkingStatus.OCCUPIED;
                        const isSelected = spot.id === selectedSpotId && isEditMode;
                        const isDraggingThis = draggingMarkerId === spot.id;
                        const isMoto = spot.type === VehicleType.MOTORCYCLE;

                        return (
                        <div
                            key={spot.id}
                            data-marker="true"
                            onMouseDown={(e) => handleMarkerMouseDown(e, spot.id)}
                            onClick={(e) => handleMarkerClick(e, spot.id)}
                            onContextMenu={(e) => handleMarkerRightClick(e, spot.id)}
                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 
                            ${isDraggingThis ? 'transition-none z-[100]' : 'transition-all duration-300'}
                            ${isEditMode && !isDrawingZone && !readOnly ? 'cursor-move' : readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
                            ${isSelected ? 'z-50 ring-4 ring-yellow-400 scale-125' : 'z-10'}
                            ${!isDraggingThis && isEditMode && !isDrawingZone && !readOnly ? 'hover:scale-125' : ''}
                            `}
                            style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                            title={`${spot.id} (${spot.status})`}
                        >
                            <div className={`
                                rounded-full flex items-center justify-center shadow-lg border-2
                                ${isMoto ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5 sm:w-6 sm:h-6'}
                                ${isOccupied 
                                    ? 'bg-rose-500 border-rose-700 text-white' 
                                    : 'bg-emerald-500 border-emerald-700 text-white'}
                            `}>
                                {spot.type === VehicleType.CAR 
                                    ? <Car size={12} /> 
                                    : <Bike size={10} strokeWidth={2.5} />
                                }
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Edit Mode Toggle - Only for Admin */}
            {!readOnly && (
                <div className="absolute top-4 right-4 flex gap-2 z-20">
                    <button
                        onClick={() => {
                            setIsEditMode(!isEditMode);
                            setIsDrawingZone(false); // Reset drawing if exiting
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium shadow-lg backdrop-blur-sm transition-all
                        ${isEditMode 
                            ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                            : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600'}`}
                    >
                        {isEditMode ? <Unlock size={16} /> : <Lock size={16} />}
                        {isEditMode ? 'Finish Editing' : 'Edit Layout'}
                    </button>
                </div>
            )}

            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
                <button 
                    onClick={handleZoomIn}
                    className="bg-slate-800/90 p-2 rounded-lg text-white shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors"
                    title="Zoom In"
                >
                    <ZoomIn size={20} />
                </button>
                <button 
                    onClick={handleZoomOut}
                    className="bg-slate-800/90 p-2 rounded-lg text-white shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors"
                    title="Zoom Out"
                >
                    <ZoomOut size={20} />
                </button>
                <button 
                    onClick={handleResetZoom}
                    className="bg-slate-800/90 p-2 rounded-lg text-white shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors"
                    title="Reset View"
                >
                    <RotateCcw size={20} />
                </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl m-4 bg-slate-800/50">
            <div className="text-center p-8 max-w-md">
              <div className="bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapIcon className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                 {readOnly ? "No Map Uploaded" : "Upload Parking Plan"}
              </h3>
              <p className="text-slate-400 mb-8">
                 {readOnly ? "The administrator has not uploaded a map layout yet." : "Upload a photo or blueprint of your parking lot to visually map the parking spaces."}
              </p>
              
              {!readOnly && (
                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors inline-flex items-center gap-2">
                    <Upload size={20} />
                    Select Image
                    <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload}
                    />
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Controls (Visible in Edit Mode and NOT ReadOnly) */}
      {isEditMode && image && !readOnly && (
        <div className="w-full lg:w-80 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col h-full max-h-[calc(100vh-12rem)]">
            <div className="mb-4 shrink-0 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MousePointer2 className="text-amber-400" size={20} />
                    Editor Tools
                </h3>
                <button
                    onClick={handleSave}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSaved 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                >
                    {isSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                    {isSaved ? 'Saved!' : 'Save Layout'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                
                {/* Zone Management */}
                <div>
                     <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zones</h4>
                        <button 
                            onClick={() => {
                                setIsDrawingZone(!isDrawingZone);
                                setSelectedSpotId(null);
                            }}
                            className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                                isDrawingZone 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-slate-700 text-indigo-300 hover:bg-slate-600'
                            }`}
                        >
                            <SquareDashed size={14} />
                            {isDrawingZone ? 'Cancel Draw' : 'Add Zone'}
                        </button>
                    </div>
                    
                    {zones.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center py-2">No zones defined. Click 'Add Zone' to draw one.</p>
                    ) : (
                        <div className="space-y-2">
                            {zones.map(zone => (
                                <div key={zone.id} className="bg-slate-900/50 p-2 rounded-lg border border-slate-700 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <input 
                                            type="text" 
                                            value={zone.label}
                                            onChange={(e) => onUpdateZone(zone.id, { label: e.target.value })}
                                            className="bg-transparent text-sm text-slate-200 focus:outline-none focus:border-b border-indigo-500 w-full mr-2"
                                        />
                                        <button 
                                            onClick={() => onDeleteZone(zone.id)}
                                            className="text-slate-500 hover:text-rose-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {['bg-indigo-500', 'bg-orange-500', 'bg-purple-500', 'bg-rose-500'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => onUpdateZone(zone.id, { color: c })}
                                                className={`w-4 h-4 rounded-full ${c.replace('bg-', 'bg-')} ${zone.color === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="h-px bg-slate-700 w-full" />

                {/* Spot Plotting */}
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Spot Plotting</h4>
                    {activeSpot && !isDrawingZone && (
                        <div className="mb-4 p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg animate-in slide-in-from-top-2">
                            <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Currently Placing</span>
                            <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-2 text-white font-mono">
                                    {activeSpot.type === VehicleType.CAR ? <Car size={16} /> : <Bike size={16} />}
                                    {activeSpot.id}
                                </div>
                                <span className="text-xs text-indigo-400">Click map to place</span>
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-400">Unmapped Spots</span>
                            <span className="text-xs font-bold text-slate-300">{unmappedSpots.length} left</span>
                        </div>
                        
                        {unmappedSpots.length === 0 ? (
                            <div className="text-center py-4 text-emerald-500 flex flex-col items-center gap-2">
                                <CheckCircle2 size={24} />
                                <span className="text-sm">All spots mapped!</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {unmappedSpots.map(spot => (
                                    <button
                                        key={spot.id}
                                        onClick={() => {
                                            setSelectedSpotId(spot.id);
                                            setIsDrawingZone(false);
                                        }}
                                        className={`px-2 py-1.5 rounded text-xs font-mono border transition-all
                                            ${selectedSpotId === spot.id 
                                                ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-500/20' 
                                                : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-500 hover:bg-slate-600'}
                                        `}
                                    >
                                        {spot.id}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <button 
                onClick={() => {
                    setIsEditMode(false);
                    setSelectedSpotId(null);
                    setIsDrawingZone(false);
                }}
                className="mt-4 shrink-0 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
            >
                Done Editing
            </button>
        </div>
      )}
    </div>
  );
};
