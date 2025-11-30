import React from 'react';
import { ParkingSpot, ParkingStatus, VehicleType } from '../types';
import { Car, Bike, Lock } from 'lucide-react';

interface SpotGridProps {
  spots: ParkingSpot[];
  onToggle: (id: string) => void;
  title: string;
  type: VehicleType;
  readOnly?: boolean;
}

export const SpotGrid: React.FC<SpotGridProps> = ({ spots, onToggle, title, type, readOnly = false }) => {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          {type === VehicleType.CAR ? <Car className="text-blue-400" /> : <Bike className="text-orange-400" />}
          {title} <span className="text-slate-500 text-sm font-normal">({spots.length} Spots)</span>
        </h2>
        <div className="flex gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> Free
            </div>
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span> Occupied
            </div>
        </div>
      </div>
      
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
        {spots.map((spot) => {
          const isOccupied = spot.status === ParkingStatus.OCCUPIED;
          return (
            <button
              key={spot.id}
              onClick={() => !readOnly && onToggle(spot.id)}
              disabled={readOnly}
              className={`
                relative group flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-300
                ${readOnly ? 'cursor-default opacity-90' : 'cursor-pointer'}
                ${isOccupied 
                  ? 'bg-rose-900/20 border-rose-800/50' 
                  : 'bg-emerald-900/20 border-emerald-800/50'}
                ${!readOnly && isOccupied ? 'hover:bg-rose-900/40 hover:border-rose-700' : ''}
                ${!readOnly && !isOccupied ? 'hover:bg-emerald-900/40 hover:border-emerald-700' : ''}
              `}
            >
              <div className={`mb-1 transition-transform ${!readOnly ? 'group-hover:scale-110' : ''} ${isOccupied ? 'text-rose-500' : 'text-emerald-500'}`}>
                {type === VehicleType.CAR ? <Car size={20} /> : <Bike size={20} />}
              </div>
              <span className={`text-xs font-mono font-bold ${isOccupied ? 'text-rose-300' : 'text-emerald-300'}`}>
                {spot.id}
              </span>
              
              {/* Status Indicator Dot */}
              <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.8)]' : 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};