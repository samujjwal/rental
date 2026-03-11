import { Upload, X } from "lucide-react";

interface ImageUploadStepProps {
  imageUrls: string[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
  error?: string;
}

export function ImageUploadStep({
  imageUrls,
  onUpload,
  onRemove,
  error,
}: ImageUploadStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">
        Upload Images
      </h2>

      <div
        className="border-2 border-dashed border-input rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
        data-testid="image-upload-area"
      >
        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">
          Upload up to 10 images of your item
        </p>
        <label className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 cursor-pointer transition-colors">
          Choose Files
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onUpload}
            className="hidden"
          />
        </label>
      </div>

      {imageUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {imageUrls.map((url, index) => (
            <div
              key={index}
              className="relative aspect-square"
              data-testid="image-preview"
            >
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
