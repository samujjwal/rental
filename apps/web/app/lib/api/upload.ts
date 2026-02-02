import { api } from "~/lib/api-client";

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  mimeType: string;
  thumbnails?: Array<{ url: string; key: string; size: string }>;
}

export const uploadApi = {
  async uploadImage(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<UploadResult>("/upload/image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  async uploadImages(files: File[]): Promise<UploadResult[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return api.post<UploadResult[]>("/upload/images", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};
