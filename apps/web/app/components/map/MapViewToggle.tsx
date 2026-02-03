import { Button } from '@mui/material';
import { Map, List } from 'lucide-react';

export interface MapViewToggleProps {
    view: 'list' | 'map';
    onViewChange: (view: 'list' | 'map') => void;
    className?: string;
}

export function MapViewToggle({ view, onViewChange, className = '' }: MapViewToggleProps) {
    return (
        <div className={`inline-flex rounded-lg border border-gray-300 bg-white shadow-sm ${className}`}>
            <Button
                onClick={() => onViewChange('list')}
                variant={view === 'list' ? 'contained' : 'text'}
                startIcon={<List size={18} />}
                sx={{
                    borderRadius: '0.5rem 0 0 0.5rem',
                    textTransform: 'none',
                    px: 2,
                    py: 1,
                    ...(view === 'list' && {
                        backgroundColor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                            backgroundColor: 'primary.dark',
                        },
                    }),
                }}
            >
                List
            </Button>
            <Button
                onClick={() => onViewChange('map')}
                variant={view === 'map' ? 'contained' : 'text'}
                startIcon={<Map size={18} />}
                sx={{
                    borderRadius: '0 0.5rem 0.5rem 0',
                    textTransform: 'none',
                    px: 2,
                    py: 1,
                    ...(view === 'map' && {
                        backgroundColor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                            backgroundColor: 'primary.dark',
                        },
                    }),
                }}
            >
                Map
            </Button>
        </div>
    );
}
