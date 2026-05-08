/**
 * Geo Engine Component
 * 
 * Handles geospatial search operations including:
 * - Radius parsing (km/mi)
 * - Bounding box calculation
 * - Haversine distance calculation
 * - Geo filtering and sorting
 */

import { Injectable, Logger } from '@nestjs/common';

export interface GeoSearchParams {
  lat: number;
  lon: number;
  radius?: string; // e.g., "10km" or "5mi" or plain number in km
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface GeoFilterResult {
  withinRadius: boolean;
  distance: number;
}

@Injectable()
export class GeoEngineComponent {
  private readonly logger = new Logger(GeoEngineComponent.name);

  /**
   * Parse radius string (e.g., "10km", "5mi", "25") into kilometers.
   * Defaults to 25km if no unit is specified.
   */
  parseRadiusKm(radius?: string): number {
    if (!radius) return 25; // default 25km
    const match = radius.match(/^(\d+(?:\.\d+)?)\s*(km|mi)?$/i);
    if (!match) return 25;
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'km').toLowerCase();
    return unit === 'mi' ? value * 1.60934 : value;
  }

  /**
   * Calculate bounding box for a given center point and radius.
   * Approximate: 1 degree latitude ≈ 111km.
   */
  calculateBoundingBox(center: GeoSearchParams): BoundingBox {
    const radiusKm = this.parseRadiusKm(center.radius);
    const lat = center.lat;
    const lon = center.lon;

    // Approximate bounding box (1 degree latitude ≈ 111km)
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLon: lon - lonDelta,
      maxLon: lon + lonDelta,
    };
  }

  /**
   * Build Prisma where clause for bounding box filter.
   */
  buildBoundingBoxWhere(box: BoundingBox): any {
    return {
      latitude: {
        not: null,
        gte: box.minLat,
        lte: box.maxLat,
      },
      longitude: {
        not: null,
        gte: box.minLon,
        lte: box.maxLon,
      },
    };
  }

  /**
   * Calculate Haversine distance between two points in kilometers.
   * Formula: a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
   * c = 2·atan2(√a, √(1−a))
   * d = R·c (where R = Earth's radius ≈ 6371 km)
   */
  haversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Filter listings by radius using Haversine distance.
   * Returns filtered listings and a map of distances.
   */
  filterByRadius(
    listings: any[],
    center: GeoSearchParams,
  ): { filtered: any[]; distanceMap: Map<string, number> } {
    const radiusKm = this.parseRadiusKm(center.radius);
    const lat = center.lat;
    const lon = center.lon;
    const distanceMap = new Map<string, number>();

    const filtered = listings.filter((listing) => {
      if (listing.latitude == null || listing.longitude == null) return false;
      const dist = this.haversineDistanceKm(lat, lon, listing.latitude, listing.longitude);
      distanceMap.set(listing.id, Math.round(dist * 10) / 10);
      return dist <= radiusKm;
    });

    return { filtered, distanceMap };
  }

  /**
   * Sort listings by distance using a pre-computed distance map.
   */
  sortByDistance(listings: any[], distanceMap: Map<string, number>): any[] {
    return listings.sort((a, b) =>
      (distanceMap.get(a.id) || 0) - (distanceMap.get(b.id) || 0)
    );
  }

  /**
   * Check if a location has valid coordinates for geo search.
   */
  hasValidCoordinates(location: GeoSearchParams | null | undefined): boolean {
    return location != null && location.lat != null && location.lon != null;
  }

  /**
   * Calculate distance from a center point to a listing.
   */
  calculateDistanceFromCenter(center: GeoSearchParams, listing: any): number | null {
    if (!this.hasValidCoordinates(center) || listing.latitude == null || listing.longitude == null) {
      return null;
    }
    return this.haversineDistanceKm(
      center.lat,
      center.lon,
      listing.latitude,
      listing.longitude,
    );
  }
}
