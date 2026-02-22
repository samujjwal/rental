import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useNavigate, useActionData, useSubmit } from "react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Upload, X, CheckCircle, Sparkles, TrendingUp } from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { uploadApi } from "~/lib/api/upload";
import { aiApi } from "~/lib/api/ai";
import { listingSchema, type ListingInput } from "~/lib/validation/listing";
import type { z } from "zod";
import { redirect } from "react-router";
import { cn } from "~/lib/utils";
import { toast } from "~/lib/toast";
import { UnifiedButton, RouteErrorBoundary } from "~/components/ui";
import { Card, CardContent } from "~/components/ui";
import { getUser } from "~/utils/auth";
import { VoiceListingAssistant } from "~/components/listings/VoiceListingAssistant";
import { CategorySpecificFields } from "~/components/listings/CategorySpecificFields";
import { getCategoryFields } from "~/lib/category-fields";
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const KEYWORD_PRICE_HINTS: Array<{ pattern: RegExp; price: number }> = [
  { pattern: /(camera|lens|gopro|drone)/i, price: 45 },
  { pattern: /(car|suv|truck|van)/i, price: 85 },
  { pattern: /(bike|bicycle|scooter)/i, price: 25 },
  { pattern: /(tool|drill|saw|ladder)/i, price: 30 },
  { pattern: /(dress|suit|tuxedo|fashion)/i, price: 35 },
  { pattern: /(speaker|party|event|projector)/i, price: 55 },
];
const CITY_COORDINATE_HINTS: Record<string, { lat: number; lng: number }> = {
  "san francisco": { lat: 37.7749, lng: -122.4194 },
  "new york": { lat: 40.7128, lng: -74.006 },
  "los angeles": { lat: 34.0522, lng: -118.2437 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  houston: { lat: 29.7604, lng: -95.3698 },
  seattle: { lat: 47.6062, lng: -122.3321 },
  miami: { lat: 25.7617, lng: -80.1918 },
};

export const meta: MetaFunction = () => {
  return [
    { title: "Create Listing - Universal Rental Portal" },
    { name: "description", content: "List your item for rent" },
  ];
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login?redirectTo=/listings/new");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return redirect("/become-owner");
  }
  return null;
}

export async function clientAction({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login?redirectTo=/listings/new");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return { error: "Only owners can create listings." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent !== "create") {
    return { error: "Invalid action" };
  }
  const rawData = formData.get("data");
  if (typeof rawData !== "string") {
    return { error: "Invalid listing payload" };
  }
  if (rawData.length > 200_000) {
    return { error: "Listing payload is too large" };
  }

  let data: unknown;
  try {
    data = JSON.parse(rawData);
  } catch {
    return { error: "Invalid listing payload" };
  }
  if (!data || typeof data !== "object") {
    return { error: "Invalid listing payload" };
  }

  const parsedData = listingSchema.safeParse(data);
  if (!parsedData.success) {
    return {
      error: parsedData.error.issues[0]?.message || "Invalid listing data",
    };
  }

  try {
    const categories = await listingsApi.getCategories();
    const validCategoryIds = new Set((categories || []).map((category) => category.id));
    if (!validCategoryIds.has(parsedData.data.category)) {
      return { error: "Please select a valid listing category." };
    }

    const listing = await listingsApi.createListing(parsedData.data as ListingInput);
    return redirect(`/listings/${listing.id}`);
  } catch (error: unknown) {
    return {
      error:
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to create listing. Please try again."
          : "Failed to create listing. Please try again.",
    };
  }
}

const STEPS = [
  { id: 1, name: "Basic Info", fields: ["title", "description", "category"] },
  {
    id: 2,
    name: "Pricing",
    fields: ["basePrice", "securityDeposit", "condition"],
  },
  {
    id: 3,
    name: "Location",
    fields: ["location"],
  },
  {
    id: 4,
    name: "Details",
    fields: [
      "deliveryOptions",
      "minimumRentalPeriod",
      "cancellationPolicy",
      "features",
    ],
  },
  { id: 5, name: "Images", fields: ["photos"] },
];

export default function CreateListing() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<typeof clientAction>();
  const [currentStep, setCurrentStep] = useState(1);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const imageUrlsRef = useRef<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [categorySpecificData, setCategorySpecificData] = useState<Record<string, unknown>>({});
  const [priceSuggestion, setPriceSuggestion] = useState<{
    averagePrice: number;
    medianPrice: number;
    suggestedRange: { low: number; high: number };
    sampleSize: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof listingSchema>>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      instantBooking: false,
      deliveryOptions: {
        pickup: true,
        delivery: false,
        shipping: false,
      },
      features: [],
      securityDeposit: 0,
      minimumRentalPeriod: 1,
      cancellationPolicy: "moderate",
    },
  });

  const deliveryOptions = watch("deliveryOptions");
  const selectedCategoryId = watch("category");

  // Resolve selected category slug for dynamic fields
  const selectedCategorySlug = useMemo(() => {
    if (!selectedCategoryId) return undefined;
    const cat = categories.find((c) => c.id === selectedCategoryId);
    return cat?.slug;
  }, [selectedCategoryId, categories]);

  // Reset category-specific data when category changes
  useEffect(() => {
    setCategorySpecificData({});
  }, [selectedCategorySlug]);

  const handleCategoryFieldChange = useCallback((key: string, value: unknown) => {
    setCategorySpecificData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Real-time listing completeness score
  const watchedValues = watch();
  const completenessScore = useMemo(() => {
    const checks = [
      { filled: !!watchedValues.title && watchedValues.title.length >= 10, weight: 10 },
      { filled: !!watchedValues.description && watchedValues.description.length >= 50, weight: 15 },
      { filled: !!watchedValues.category, weight: 10 },
      { filled: typeof watchedValues.basePrice === 'number' && watchedValues.basePrice > 0, weight: 10 },
      { filled: !!watchedValues.condition, weight: 5 },
      { filled: !!watchedValues.location?.city, weight: 10 },
      { filled: !!watchedValues.location?.address, weight: 5 },
      { filled: !!watchedValues.location?.country, weight: 5 },
      { filled: imageUrls.length >= 3, weight: 20 },
      { filled: imageUrls.length >= 5, weight: 5 },
      { filled: !!watchedValues.features && watchedValues.features.length > 0, weight: 5 },
    ];
    const total = checks.reduce((s, c) => s + c.weight, 0);
    const earned = checks.filter((c) => c.filled).reduce((s, c) => s + c.weight, 0);
    return Math.round((earned / total) * 100);
  }, [watchedValues, imageUrls]);

  useEffect(() => {
    imageUrlsRef.current = imageUrls;
  }, [imageUrls]);

  useEffect(() => {
    if (actionData?.error) {
      setIsSubmitting(false);
    }
  }, [actionData?.error]);

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      try {
        const data = await listingsApi.getCategories();
        if (!mounted) return;
        setCategories(
          (data || []).map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug || category.name.toLowerCase().replace(/\s+/g, "-"),
          }))
        );
      } catch {
        if (!mounted) return;
        setCategories([]);
        setCategoriesError("Unable to load categories. Please try again later.");
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    };
    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Fetch price suggestion when entering the Pricing step
  useEffect(() => {
    if (currentStep !== 2) return;
    let cancelled = false;

    const fetchSuggestion = async () => {
      try {
        const categoryId = getValues("category");
        const city = getValues("location.city");
        const condition = getValues("condition");
        if (!categoryId && !city) return;

        const result = await listingsApi.getPriceSuggestion({
          categoryId: categoryId || undefined,
          city: city || undefined,
          condition: condition || undefined,
        });

        if (!cancelled && result.sampleSize > 0) {
          setPriceSuggestion(result);
        }
      } catch {
        // Silently ignore — price suggestions are non-critical
      }
    };

    fetchSuggestion();
    return () => { cancelled = true; };
  }, [currentStep, getValues]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(
      (file) => file.type.startsWith("image/") && file.size <= MAX_IMAGE_FILE_SIZE
    );
    if (files.length + imageFiles.length > 10) {
      toast.warning("Maximum 10 images allowed");
      return;
    }
    if (validFiles.length !== files.length) {
      toast.warning("Only image files up to 10MB are allowed.");
      return;
    }

    const newImageUrls = validFiles.map((file) => URL.createObjectURL(file));
    setImageUrls([...imageUrls, ...newImageUrls]);
    setImageFiles([...imageFiles, ...validFiles]);
    setValue("photos", [...imageUrls, ...newImageUrls]);
  };

  const removeImage = (index: number) => {
    if (imageUrls[index]) {
      URL.revokeObjectURL(imageUrls[index]);
    }
    const newImageUrls = imageUrls.filter((_, i) => i !== index);
    const newImageFiles = imageFiles.filter((_, i) => i !== index);
    setImageUrls(newImageUrls);
    setImageFiles(newImageFiles);
    setValue("photos", newImageUrls);
  };

  const onSubmit = async (data: z.input<typeof listingSchema>) => {
    setIsSubmitting(true);
    try {
      if (imageFiles.length === 0) {
        setError("photos", { type: "manual", message: "At least one image is required" });
        setIsSubmitting(false);
        return;
      }

      const parsed = listingSchema.parse(data) as ListingInput;

      const results = await uploadApi.uploadImages(imageFiles);
      const finalImages = results.map((r) => r.url).filter(Boolean);
      if (finalImages.length === 0) {
        setError("photos", { type: "manual", message: "Image upload failed. Please try again." });
        setIsSubmitting(false);
        return;
      }

      // Update data with real image URLs
      const payload = {
        ...parsed,
        images: finalImages,
        categorySpecificData: Object.keys(categorySpecificData).length > 0 ? categorySpecificData : undefined,
      };

      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("data", JSON.stringify(payload));

      submit(formData, { method: "post" });
    } catch (error) {
      console.error("Failed to create listing:", error);
      toast.error("Failed to create listing. Please try again.");
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const applyVoiceField = (field: string, value: unknown) => {
    setValue(field as keyof z.input<typeof listingSchema>, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const inferCategoryId = (title: string, description: string): string | undefined => {
    const text = `${title} ${description}`.toLowerCase();
    const direct = categories.find((category) => text.includes(category.name.toLowerCase()));
    if (direct) return direct.id;

    const hints: Array<{ keyword: RegExp; names: string[] }> = [
      { keyword: /(camera|lens|drone|gopro|photo)/i, names: ["electronics", "photography"] },
      { keyword: /(car|truck|suv|bike|scooter|vehicle)/i, names: ["vehicle", "vehicles", "transport"] },
      { keyword: /(tool|drill|ladder|saw|generator)/i, names: ["tools", "equipment"] },
      { keyword: /(dress|suit|tuxedo|fashion|jewelry)/i, names: ["fashion", "wearables", "clothing"] },
      { keyword: /(party|speaker|projector|event)/i, names: ["event", "party"] },
    ];

    for (const hint of hints) {
      if (!hint.keyword.test(text)) continue;
      const match = categories.find((category) =>
        hint.names.some((name) => category.name.toLowerCase().includes(name))
      );
      if (match) return match.id;
    }

    return categories[0]?.id;
  };

  const inferCondition = (title: string, description: string): ListingInput["condition"] => {
    const text = `${title} ${description}`.toLowerCase();
    if (/brand new|unused|sealed/.test(text)) return "new";
    if (/like new|mint|excellent/.test(text)) return "like-new";
    if (/fair|visible wear/.test(text)) return "fair";
    if (/poor|damaged|for parts/.test(text)) return "poor";
    return "good";
  };

  const inferDailyPrice = (title: string, description: string): number => {
    const text = `${title} ${description}`;
    const explicit = text.match(/\$?\s*(\d{1,4})(?:\.\d+)?\s*(?:\/day|per day|daily)/i);
    if (explicit) return Math.max(1, Math.min(10000, Number(explicit[1])));
    const hint = KEYWORD_PRICE_HINTS.find((entry) => entry.pattern.test(text));
    return hint?.price ?? 30;
  };

  const inferCoordinates = (city: string, lat?: number, lng?: number) => {
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng };
    }
    const key = city.trim().toLowerCase();
    return CITY_COORDINATE_HINTS[key] || { lat: 0, lng: 0 };
  };

  const inferFeatureHints = (title: string, description: string): string[] => {
    const text = `${title} ${description}`.toLowerCase();
    const features: string[] = [];
    if (/waterproof/.test(text)) features.push("waterproof");
    if (/wireless|bluetooth/.test(text)) features.push("wireless");
    if (/portable/.test(text)) features.push("portable");
    if (/professional|pro/.test(text)) features.push("professional-grade");
    return features;
  };

  const submitListing = async (rawData: z.input<typeof listingSchema>) => {
    setIsSubmitting(true);
    try {
      if (imageFiles.length === 0) {
        setError("photos", { type: "manual", message: "At least one image is required" });
        setIsSubmitting(false);
        return;
      }

      const parsed = listingSchema.parse(rawData) as ListingInput;
      const results = await uploadApi.uploadImages(imageFiles);
      const finalImages = results.map((r) => r.url).filter(Boolean);
      if (finalImages.length === 0) {
        setError("photos", { type: "manual", message: "Image upload failed. Please try again." });
        setIsSubmitting(false);
        return;
      }

      const payload = { ...parsed, images: finalImages, categorySpecificData: Object.keys(categorySpecificData).length > 0 ? categorySpecificData : undefined };
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("data", JSON.stringify(payload));
      submit(formData, { method: "post" });
    } catch (error) {
      console.error("Failed to create listing:", error);
      toast.error("Failed to create listing. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleGenerateDescription = async () => {
    const title = String(getValues("title") || "").trim();
    if (!title || title.length < 3) {
      toast.error("Enter a title first to generate a description");
      return;
    }
    setIsGeneratingDescription(true);
    try {
      const categoryId = getValues("category");
      const categoryName = categories.find((c) => c.id === categoryId)?.name;
      const city = getValues("location.city");
      const result = await aiApi.generateDescription({
        title,
        category: categoryName,
        city: typeof city === "string" ? city : undefined,
      });
      setValue("description", result.description, { shouldValidate: true });
      toast.success("Description generated");
    } catch {
      toast.error("Failed to generate description. Please write one manually.");
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleQuickCreate = async () => {
    const values = getValues();
    const title = String(values.title || "").trim();
    const description = String(values.description || "").trim();
    const category = values.category || inferCategoryId(title, description) || "";
    const condition = values.condition || inferCondition(title, description);

    // Validate required category-specific fields
    const catSlug = categories.find((c) => c.id === category)?.slug;
    const catFields = getCategoryFields(catSlug);
    const missingRequired = catFields.filter(
      (f) => f.required && (categorySpecificData[f.key] === undefined || categorySpecificData[f.key] === "" || categorySpecificData[f.key] === null)
    );
    if (missingRequired.length > 0) {
      toast.error(`Please fill in required fields: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    const basePrice =
      typeof values.basePrice === "number" && Number.isFinite(values.basePrice)
        ? values.basePrice
        : priceSuggestion?.medianPrice ?? inferDailyPrice(title, description);
    const city = String(values.location?.city || "").trim();
    const coords = inferCoordinates(
      city,
      values.location?.coordinates?.lat,
      values.location?.coordinates?.lng
    );
    const features =
      values.features && values.features.length > 0
        ? values.features
        : inferFeatureHints(title, description);

    const aiFilled: z.input<typeof listingSchema> = {
      ...values,
      category,
      condition,
      basePrice,
      securityDeposit:
        typeof values.securityDeposit === "number" && Number.isFinite(values.securityDeposit)
          ? values.securityDeposit
          : Math.round(basePrice * 2),
      minimumRentalPeriod:
        typeof values.minimumRentalPeriod === "number" && values.minimumRentalPeriod > 0
          ? values.minimumRentalPeriod
          : 1,
      cancellationPolicy: values.cancellationPolicy || "moderate",
      deliveryOptions: values.deliveryOptions || {
        pickup: true,
        delivery: false,
        shipping: false,
      },
      instantBooking: values.instantBooking ?? false,
      features,
      location: {
        address: values.location?.address || "",
        city: values.location?.city || "",
        state: values.location?.state || "",
        country: values.location?.country || "",
        postalCode: values.location?.postalCode || "",
        coordinates: coords,
      },
      images: values.photos || [],
    };

    setValue("category", aiFilled.category);
    setValue("condition", aiFilled.condition);
    setValue("basePrice", aiFilled.basePrice);
    setValue("securityDeposit", aiFilled.securityDeposit);
    setValue("minimumRentalPeriod", aiFilled.minimumRentalPeriod);
    setValue("features", aiFilled.features || []);
    setValue("location.coordinates.lat", aiFilled.location.coordinates.lat);
    setValue("location.coordinates.lng", aiFilled.location.coordinates.lng);

    await submitListing(aiFilled);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-xl font-bold text-foreground">
              Create New Listing
            </h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h2 className="text-lg font-semibold text-foreground">Quick Create (AI-assisted)</h2>
          <p className="text-sm text-muted-foreground">
            Fill a few basics, upload images, then click once. AI will auto-fill missing details.
          </p>
        </div>

        <div className="mb-8 rounded-lg border border-input bg-card p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-foreground">Title *</label>
              <input
                {...register("title")}
                type="text"
                maxLength={100}
                placeholder="e.g., Sony A7 IV camera with 24-70 lens"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
              {errors.title && <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>}
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">Description *</label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDescription}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                >
                  <Sparkles className={cn("w-3.5 h-3.5", isGeneratingDescription && "animate-spin")} />
                  {isGeneratingDescription ? "Generating…" : "Generate with AI"}
                </button>
              </div>
              <textarea
                {...register("description")}
                rows={4}
                maxLength={2000}
                placeholder="Describe the item and what is included..."
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Category</label>
              <select
                {...register("category")}
                data-testid="category-select"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              >
                <option value="">{loadingCategories ? "Loading categories..." : "Auto (AI will choose)"}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">City *</label>
              <input
                {...register("location.city")}
                type="text"
                maxLength={80}
                placeholder="San Francisco"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
              {errors.location?.city && (
                <p className="mt-1 text-sm text-destructive">{errors.location.city.message}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Address *</label>
              <input
                {...register("location.address")}
                type="text"
                maxLength={200}
                placeholder="123 Main St"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">State *</label>
              <input
                {...register("location.state")}
                type="text"
                maxLength={80}
                placeholder="CA"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Country *</label>
              <input
                {...register("location.country")}
                type="text"
                maxLength={80}
                placeholder="USA"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Postal Code *</label>
              <input
                {...register("location.postalCode")}
                type="text"
                maxLength={20}
                placeholder="94102"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Category-Specific Fields (Quick Create) */}
          <CategorySpecificFields
            categorySlug={selectedCategorySlug}
            values={categorySpecificData}
            onChange={handleCategoryFieldChange}
          />

          <div className="mt-4">
            <div
              className="rounded-lg border-2 border-dashed border-input p-6 text-center transition-colors hover:border-primary/50"
              data-testid="image-upload-area"
            >
              <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="mb-3 text-sm text-muted-foreground">Upload at least one image</p>
              <label className="inline-block cursor-pointer rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
                Choose Files
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
            {imageUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square" data-testid="image-preview">
                    <img src={url} alt={`Upload ${index + 1}`} className="h-full w-full rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errors.photos && <p className="mt-2 text-sm text-destructive">{errors.photos.message}</p>}
          </div>
          <div className="mt-6 flex items-center justify-end">
            <UnifiedButton
              type="button"
              onClick={handleQuickCreate}
              data-testid="create-listing-button"
              disabled={isSubmitting}
              loading={isSubmitting}
              leftIcon={!isSubmitting ? <CheckCircle className="h-5 w-5" /> : undefined}
              variant="success"
            >
              {isSubmitting ? "Creating..." : "Create New Listing"}
            </UnifiedButton>
          </div>
        </div>

        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAdvancedEditor((prev) => !prev)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {showAdvancedEditor ? "Hide Advanced Manual Editor" : "Open Advanced Manual Editor"}
          </button>
        </div>

        {showAdvancedEditor && (
          <div>
            {/* Completeness Progress Bar */}
            <div className="mb-6 p-4 bg-card rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Listing Completeness</span>
                <span className={cn(
                  "text-sm font-bold",
                  completenessScore >= 80 ? "text-success" : completenessScore >= 50 ? "text-warning" : "text-muted-foreground"
                )}>
                  {completenessScore}%
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    completenessScore >= 80 ? "bg-success" : completenessScore >= 50 ? "bg-warning" : "bg-muted-foreground"
                  )}
                  style={{ width: `${completenessScore}%` }}
                />
              </div>
              {completenessScore < 80 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Complete more fields to improve visibility and attract more renters
                </p>
              )}
            </div>
            <div className="mb-8" data-testid="step-indicator">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
                    currentStep > step.id
                      ? "bg-success text-success-foreground"
                      : currentStep === step.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-full h-1 mx-2 transition-colors",
                      currentStep > step.id ? "bg-success" : "bg-muted"
                    )}
                    style={{ minWidth: "60px" }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className="text-center"
                style={{ width: "80px" }}
              >
                {step.name}
              </div>
            ))}
          </div>
        </div>
          </div>
        )}

        {/* Error Message */}
        {actionData?.error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{actionData.error}</p>
          </div>
        )}

        <VoiceListingAssistant
          categories={categories}
          onSetField={applyVoiceField}
          onNextStep={nextStep}
          onPrevStep={prevStep}
        />

        {showAdvancedEditor && (
          <Form id="listing-form" method="post" onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" name="intent" value="create" />
          <Card>
            <CardContent className="p-8">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Basic Information
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Title *
                    </label>
                    <input
                      {...register("title")}
                      type="text"
                      maxLength={100}
                      placeholder="e.g., Professional DSLR Camera Canon EOS 5D"
                      className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                    {errors.title && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.title.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Description *
                    </label>
                    <textarea
                      {...register("description")}
                      rows={6}
                      maxLength={2000}
                      placeholder="Describe your item in detail..."
                      className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                    {errors.description && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Category *
                    </label>
                  <select
                    {...register("category")}
                    data-testid="category-select"
                    className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                  >
                    <option value="">
                      {loadingCategories ? "Loading categories..." : "Select a category"}
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {categoriesError && (
                    <p className="mt-1 text-sm text-destructive">
                      {categoriesError}
                    </p>
                  )}
                    {errors.category && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.category.message}
                      </p>
                    )}
                  </div>

                  {/* Category-Specific Fields (Advanced Editor) */}
                  <CategorySpecificFields
                    categorySlug={selectedCategorySlug}
                    values={categorySpecificData}
                    onChange={handleCategoryFieldChange}
                  />
                </div>
              )}

              {/* Step 2: Pricing */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Pricing & Condition
                  </h2>

                  {/* Price Suggestion Banner */}
                  {priceSuggestion && (
                    <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          Price suggestion based on {priceSuggestion.sampleSize} similar listing{priceSuggestion.sampleSize !== 1 ? "s" : ""}
                        </p>
                        <p className="text-blue-700 dark:text-blue-300 mt-1">
                          Suggested range: <strong>${priceSuggestion.suggestedRange.low} – ${priceSuggestion.suggestedRange.high}/day</strong>
                          {" "}(avg ${priceSuggestion.averagePrice}, median ${priceSuggestion.medianPrice})
                        </p>
                        <button
                          type="button"
                          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          onClick={() => setValue("basePrice", priceSuggestion.medianPrice)}
                        >
                          Use median price (${priceSuggestion.medianPrice})
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Price per Day * ($)
                    </label>
                    <input
                      {...register("basePrice", { valueAsNumber: true })}
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="25.00"
                      className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                    {errors.basePrice && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.basePrice.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Price per Week ($)
                      </label>
                      <input
                        {...register("pricePerWeek", { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="150.00"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Price per Month ($)
                      </label>
                      <input
                        {...register("pricePerMonth", { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="500.00"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Security Deposit * ($)
                    </label>
                    <input
                      {...register("securityDeposit", { valueAsNumber: true })}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="100.00"
                      className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                    {errors.securityDeposit && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.securityDeposit.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Condition *
                    </label>
                    <select
                      {...register("condition")}
                      className="w-full px-4 py-3 border border-input rounded-lg bg-background capitalize focus:ring-2 focus:ring-ring transition-colors"
                    >
                      <option value="">Select condition</option>
                      <option value="new">New</option>
                      <option value="like-new">Like New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                    {errors.condition && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.condition.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Location */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Location
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Address *
                    </label>
                    <input
                      {...register("location.address")}
                      type="text"
                      maxLength={200}
                      placeholder="123 Main Street"
                      className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                    {errors.location?.address && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.location.address.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        City *
                      </label>
                      <input
                        {...register("location.city")}
                        type="text"
                        maxLength={80}
                        placeholder="San Francisco"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                      {errors.location?.city && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.location.city.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        State *
                      </label>
                      <input
                        {...register("location.state")}
                        type="text"
                        maxLength={80}
                        placeholder="CA"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                      {errors.location?.state && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.location.state.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Country *
                      </label>
                      <input
                        {...register("location.country")}
                        type="text"
                        maxLength={80}
                        placeholder="USA"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                      {errors.location?.country && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.location.country.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Postal Code *
                      </label>
                      <input
                        {...register("location.postalCode")}
                        type="text"
                        maxLength={20}
                        placeholder="94102"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                      {errors.location?.postalCode && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.location.postalCode.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Latitude *
                      </label>
                      <input
                        {...register("location.coordinates.lat", {
                          valueAsNumber: true,
                        })}
                        type="number"
                        step="any"
                        placeholder="37.7749"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Longitude *
                      </label>
                      <input
                        {...register("location.coordinates.lng", {
                          valueAsNumber: true,
                        })}
                        type="number"
                        step="any"
                        placeholder="-122.4194"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Details */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Rental Details
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">
                      Delivery Options *
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          {...register("deliveryOptions.pickup")}
                          type="checkbox"
                          className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
                        />
                        <span className="text-foreground">Pickup</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          {...register("deliveryOptions.delivery")}
                          type="checkbox"
                          className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
                        />
                        <span className="text-foreground">Delivery</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          {...register("deliveryOptions.shipping")}
                          type="checkbox"
                          className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
                        />
                        <span className="text-foreground">Shipping</span>
                      </label>
                    </div>
                  </div>

                  {deliveryOptions?.delivery && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Delivery Radius (miles)
                        </label>
                        <input
                          {...register("deliveryRadius", {
                            valueAsNumber: true,
                          })}
                          type="number"
                          min="0"
                          placeholder="10"
                          className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Delivery Fee ($)
                        </label>
                        <input
                          {...register("deliveryFee", { valueAsNumber: true })}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="15.00"
                          className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Minimum Rental Period (days) *
                      </label>
                      <input
                        {...register("minimumRentalPeriod", {
                          valueAsNumber: true,
                        })}
                        type="number"
                        min="1"
                        placeholder="1"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                      {errors.minimumRentalPeriod && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.minimumRentalPeriod.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Maximum Rental Period (days)
                      </label>
                      <input
                        {...register("maximumRentalPeriod", {
                          valueAsNumber: true,
                        })}
                        type="number"
                        min="1"
                        placeholder="30"
                        className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Cancellation Policy *
                    </label>
                    <select
                      {...register("cancellationPolicy")}
                      className="w-full px-4 py-3 border border-input rounded-lg bg-background capitalize focus:ring-2 focus:ring-ring transition-colors"
                    >
                      <option value="flexible">Flexible</option>
                      <option value="moderate">Moderate</option>
                      <option value="strict">Strict</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Rental Rules
                    </label>
                    <textarea
                      {...register("rules")}
                      rows={4}
                      maxLength={1000}
                      placeholder="Any specific rules or requirements..."
                      className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        {...register("instantBooking")}
                        type="checkbox"
                        className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
                      />
                      <span className="text-sm font-medium text-foreground">
                        Allow instant booking (no approval needed)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 5: Images */}
              {currentStep === 5 && (
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
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {imageUrls.map((url, index) => (
                        <div key={index} className="relative aspect-square" data-testid="image-preview">
                          <img
                            src={url}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/90 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.photos && (
                    <p className="text-sm text-destructive">
                      {errors.photos.message}
                    </p>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                {currentStep > 1 ? (
                  <UnifiedButton
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    leftIcon={<ArrowLeft className="w-5 h-5" />}
                  >
                    Previous
                  </UnifiedButton>
                ) : (
                  <div />
                )}

                {currentStep < STEPS.length ? (
                  <UnifiedButton
                    type="button"
                    onClick={nextStep}
                    rightIcon={<ArrowRight className="w-5 h-5" />}
                  >
                    Next
                  </UnifiedButton>
                ) : (
                  <UnifiedButton
                    type="submit"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    leftIcon={!isSubmitting ? <CheckCircle className="w-5 h-5" /> : undefined}
                    variant="success"
                  >
                    {isSubmitting ? "Creating..." : "Create Listing"}
                  </UnifiedButton>
                )}
              </div>
            </CardContent>
          </Card>
          </Form>
        )}
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-end px-4 py-3 sm:px-6 lg:px-8">
          <UnifiedButton
            type="button"
            onClick={handleQuickCreate}
            data-testid="create-listing-button-sticky"
            disabled={isSubmitting}
            loading={isSubmitting}
            leftIcon={!isSubmitting ? <CheckCircle className="h-5 w-5" /> : undefined}
            variant="success"
          >
            {isSubmitting ? "Creating..." : "Create New Listing"}
          </UnifiedButton>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

