import React from 'react';
import { ParkingSpot, ParkingStatus, VehicleType } from '../types';
import { Car, Bike, Clock } from 'lucide-react';

interface SpotTableProps {
  spots: ParkingSpot[];
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export const SpotTable: React.FC<SpotTableProps> = ({ spots, onToggle, readOnly = false }) => {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-400">
          <thead className="text-xs text-slate-300 uppercase bg-slate-900/50 border-b border-slate-700">
            <tr>
              <th scope="col" className="px-6 py-4">Spot ID</th>
              <th scope="col" className="px-6 py-4">Type</th>
              <th scope="col" className="px-6 py-4">Status</th>
              <th scope="col" className="px-6 py-4">Last Updated</th>
              {!readOnly && <th scope="col" className="px-6 py-4 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {spots.map((spot) => {
               const isOccupied = spot.status === ParkingStatus.OCCUPIED;
               return (
                <tr key={spot.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200 font-mono">
                    {spot.id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        {spot.type === VehicleType.CAR ? <Car size={16} className="text-blue-400" /> : <Bike size={16} className="text-orange-400" />}
                        {spot.type}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        isOccupied 
                        ? 'bg-rose-900/30 text-rose-400 border-rose-800' 
                        : 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                        {spot.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <Clock size={14} />
                    {spot.lastUpdated ? spot.lastUpdated.toLocaleTimeString() : 'N/A'}
                  </td>
                  {!readOnly && (
                    <td className="px-6 py-4 text-right">
                        <button 
                            onClick={() => onToggle(spot.id)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium text-xs border border-indigo-500/30 hover:border-indigo-400 rounded px-3 py-1 transition-all"
                        >
                            Toggle
                        </button>
                    </td>
                  )}
                </tr>
               );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};