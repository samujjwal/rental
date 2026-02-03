import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface BaseMapProps {
    center?: [number, number];
    zoom?: number;
    bounds?: LatLngBoundsExpression;
    className?: string;
    children?: React.ReactNode;
    onMapReady?: (map: LeafletMap) => void;
    onBoundsChange?: (bounds: LatLngBoundsExpression) => void;
    scrollWheelZoom?: boolean;
    dragging?: boolean;
}

function MapEventHandler({
    onMapReady,
    onBoundsChange
}: {
    onMapReady?: (map: LeafletMap) => void;
    onBoundsChange?: (bounds: LatLngBoundsExpression) => void;
}) {
    const map = useMap();
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (!hasInitialized.current && onMapReady) {
            onMapReady(map);
            hasInitialized.current = true;
        }
    }, [map, onMapReady]);

    useEffect(() => {
        if (!onBoundsChange) return;

        const handleMoveEnd = () => {
            const bounds = map.getBounds();
            onBoundsChange([
                [bounds.getSouth(), bounds.getWest()],
                [bounds.getNorth(), bounds.getEast()],
            ]);
        };

        map.on('moveend', handleMoveEnd);
        return () => {
            map.off('moveend', handleMoveEnd);
        };
    }, [map, onBoundsChange]);

    return null;
}

export function BaseMap({
    center = [37.7749, -122.4194], // Default to San Francisco
    zoom = 12,
    bounds,
    className = 'h-full w-full',
    children,
    onMapReady,
    onBoundsChange,
    scrollWheelZoom = true,
    dragging = true,
}: BaseMapProps) {
    return (
        <MapContainer
            center={center}
            zoom={zoom}
            bounds={bounds}
            scrollWheelZoom={scrollWheelZoom}
            dragging={dragging}
            className={className}
            style={{ height: '100%', width: '100%' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
            />
            <MapEventHandler onMapReady={onMapReady} onBoundsChange={onBoundsChange} />
            {children}
        </MapContainer>
    );
}
