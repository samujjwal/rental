/**
 * useListingMedia
 *
 * Manages the image upload state for the listing creation form.
 * Handles object URL lifecycle (creation + revocation) to prevent memory leaks.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import type { UseFormSetValue } from "react-hook-form";
import type { z } from "zod";
import type { listingSchema } from "~/lib/validation/listing";
import { toast } from "~/lib/toast";

type FormValues = z.input<typeof listingSchema>;

const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_COUNT = 10;

interface UseListingMediaOptions {
  setValue: UseFormSetValue<FormValues>;
}

export function useListingMedia({ setValue }: UseListingMediaOptions) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  // Track object URLs for cleanup even after component re-renders
  const imageUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    imageUrlsRef.current = imageUrls;
  }, [imageUrls]);

  // Revoke all object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const validFiles = files.filter(
        (file) => file.type.startsWith("image/") && file.size <= MAX_IMAGE_FILE_SIZE,
      );

      if (validFiles.length !== files.length) {
        toast.warning("Only image files up to 10 MB are allowed.");
      }

      if (validFiles.length + imageFiles.length > MAX_IMAGE_COUNT) {
        toast.warning(`Maximum ${MAX_IMAGE_COUNT} images allowed`);
        return;
      }

      if (validFiles.length === 0) return;

      const newUrls = validFiles.map((file) => URL.createObjectURL(file));
      const merged = [...imageUrls, ...newUrls];
      setImageUrls(merged);
      setImageFiles((prev) => [...prev, ...validFiles]);
      setValue("photos", merged);
    },
    [imageUrls, imageFiles.length, setValue],
  );

  const removeImage = useCallback(
    (index: number) => {
      if (imageUrls[index]) {
        URL.revokeObjectURL(imageUrls[index]);
      }
      const newUrls = imageUrls.filter((_, i) => i !== index);
      setImageUrls(newUrls);
      setImageFiles((prev) => prev.filter((_, i) => i !== index));
      setValue("photos", newUrls);
    },
    [imageUrls, setValue],
  );

  return { imageUrls, imageFiles, handleImageUpload, removeImage };
}
