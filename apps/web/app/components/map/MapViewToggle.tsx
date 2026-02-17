import { Map, List } from 'lucide-react';

export interface MapViewToggleProps {
    view: 'list' | 'map';
    onViewChange: (view: 'list' | 'map') => void;
    className?: string;
}

export function MapViewToggle({ view, onViewChange, className = '' }: MapViewToggleProps) {
    return (
        <div className={`inline-flex rounded-lg border border-gray-300 bg-white shadow-sm ${className}`}>
            <button
                type="button"
                onClick={() => onViewChange('list')}
                className={`inline-flex items-center gap-1.5 rounded-l-lg px-3 py-2 text-sm font-medium transition-colors
                    ${view === 'list'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
            >
                <List size={18} />
                List
            </button>
            <button
                type="button"
                onClick={() => onViewChange('map')}
                className={`inline-flex items-center gap-1.5 rounded-r-lg px-3 py-2 text-sm font-medium transition-colors
                    ${view === 'map'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
            >
                <Map size={18} />
                Map
            </button>
        </div>
    );
}
