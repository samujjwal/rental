import { api } from "~/lib/api-client";
import type {
  Listing,
  CreateListingRequest,
  UpdateListingRequest,
  ListingSearchParams,
  ListingSearchResponse,
  Category,
} from "~/types/listing";

export const listingApi = {
  async searchListings(
    params: ListingSearchParams
  ): Promise<ListingSearchResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    return api.get<ListingSearchResponse>(
      `/listings/search?${queryParams.toString()}`
    );
  },

  async getListingById(id: string): Promise<Listing> {
    return api.get<Listing>(`/listings/${id}`);
  },

  async getMyListings(): Promise<Listing[]> {
    return api.get<Listing[]>("/listings/my-listings");
  },

  async createListing(data: CreateListingRequest): Promise<Listing> {
    return api.post<Listing>("/listings", data);
  },

  async updateListing(
    id: string,
    data: UpdateListingRequest
  ): Promise<Listing> {
    return api.patch<Listing>(`/listings/${id}`, data);
  },

  async deleteListing(id: string): Promise<void> {
    return api.delete<void>(`/listings/${id}`);
  },

  async uploadImages(id: string, files: File[]): Promise<{ urls: string[] }> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });
    return api.post<{ urls: string[] }>(`/listings/${id}/images`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  async deleteImage(id: string, imageUrl: string): Promise<void> {
    return api.delete<void>(`/listings/${id}/images`, {
      data: { imageUrl },
    });
  },

  async getCategories(): Promise<Category[]> {
    return api.get<Category[]>("/categories");
  },

  async getFeaturedListings(): Promise<Listing[]> {
    return api.get<Listing[]>("/listings/featured");
  },

  async getNearbyListings(
    lat: number,
    lng: number,
    radius: number
  ): Promise<Listing[]> {
    return api.get<Listing[]>(
      `/listings/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    );
  },

  async updateAvailability(
    id: string,
    availability: "available" | "rented" | "maintenance"
  ): Promise<Listing> {
    return api.patch<Listing>(`/listings/${id}/availability`, {
      availability,
    });
  },
};
