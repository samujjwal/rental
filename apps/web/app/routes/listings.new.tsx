import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useNavigate, useActionData, useSubmit } from "react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
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
import { useTranslation } from "react-i18next";
import { VoiceListingAssistant } from "~/components/listings/VoiceListingAssistant";
import { AIListingAssistant } from "~/components/listings/AIListingAssistant";
import { CategorySpecificFields } from "~/components/listings/CategorySpecificFields";
import type { CategoryFieldDefinition as CategoryField } from "~/lib/api/listings";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";
import { getListingDescriptionGenerationError } from "~/lib/listing-description-error";
import { getListingImageUploadError } from "~/lib/listing-image-upload-error";
import {
  ListingStepIndicator,
  LocationStep,
  DetailsStep,
  PricingStep,
  ImageUploadStep,
} from "~/components/listings/steps";
import { useListingDraft } from "~/features/listings/create/useListingDraft";
import { useListingMedia } from "~/features/listings/create/useListingMedia";
import { useListingCategories } from "~/features/listings/create/useListingCategories";
import { useListingCompletenessScore } from "~/features/listings/create/useListingCompletenessScore";
import {
  inferCategoryId,
  inferCondition,
  inferDailyPrice,
  inferCoordinates,
  inferFeatureHints,
} from "~/features/listings/create/listing-inference";

export const meta: MetaFunction = () => {
  return [
    { title: "Create Listing | GharBatai Rentals" },
    { name: "description", content: "List your item for rent" },
  ];
};

export function getCreateListingError(
  error: unknown,
  fallbackMessage = "Failed to create listing. Please try again."
): string {
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
      : null;

  if (responseMessage) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try creating the listing again.";
  }

  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.CONFLICT]: "This listing is already being created or reviewed. Refresh and check your listings.",
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try creating the listing again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Creating the listing timed out. Try again.",
  });
}

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
    return { error: getCreateListingError(error) };
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<typeof clientAction>();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [categorySpecificData, setCategorySpecificData] = useState<Record<string, unknown>>({});
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
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
    trigger,
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
  const draftValues = watch();

  // Categories must be loaded before selectedCategorySlug so the useMemo can reference the list
  const { categories, loadingCategories, categoriesError } = useListingCategories();

  // Resolve selected category slug for dynamic fields
  const selectedCategorySlug = useMemo(() => {
    if (!selectedCategoryId) return undefined;
    const cat = categories.find((c) => c.id === selectedCategoryId);
    return cat?.slug;
  }, [selectedCategoryId, categories]);

  // Reset category-specific data when category changes and load new field definitions
  useEffect(() => {
    setCategorySpecificData({});
    setCategoryFields([]);
    if (!selectedCategorySlug) return;
    let cancelled = false;
    listingsApi.getCategoryFieldDefinitions(selectedCategorySlug)
      .then((defs) => { if (!cancelled) setCategoryFields(defs); })
      .catch(() => { /* non-critical: form still works, required-field guard is skipped */ });
    return () => { cancelled = true; };
  }, [selectedCategorySlug]);

  const handleCategoryFieldChange = useCallback((key: string, value: unknown) => {
    setCategorySpecificData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const { imageUrls, imageFiles, handleImageUpload, removeImage } = useListingMedia({ setValue });
  const { hasDraft, restoreDraft, discardDraft, clearSavedDraft } = useListingDraft({
    currentStep,
    draftValues,
    categorySpecificData,
    isSubmitting,
    getValues,
    setValue,
    setCurrentStep,
    setCategorySpecificData,
  });

  const completenessScore = useListingCompletenessScore({ watch, imageUrls });

  useEffect(() => {
    if (actionData?.error) {
      setIsSubmitting(false);
    }
  }, [actionData?.error]);

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
        setError("photos", {
          type: "manual",
          message: getListingImageUploadError(null),
        });
        setIsSubmitting(false);
        return;
      }

      // Update data with real image URLs
      const payload = {
        ...parsed,
        photos: finalImages,
        categorySpecificData: Object.keys(categorySpecificData).length > 0 ? categorySpecificData : undefined,
      };

      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("data", JSON.stringify(payload));

      // Clear autosaved draft on successful submission
      clearSavedDraft();
      submit(formData, { method: "post" });
    } catch (error) {
      const uploadErrorMessage = getListingImageUploadError(error);
      setError("photos", { type: "manual", message: uploadErrorMessage });
      toast.error(uploadErrorMessage);
      setIsSubmitting(false);
    }
  };

  const STEP_VALIDATION_FIELDS: Record<number, string[]> = {
    1: ["title", "description", "category"],
    2: ["basePrice", "securityDeposit", "condition"],
    3: [
      "location.address",
      "location.city",
      "location.state",
      "location.country",
      "location.postalCode",
    ],
    4: ["deliveryOptions", "minimumRentalPeriod", "cancellationPolicy"],
    5: [], // Images validated separately via imageFiles
  };

  const nextStep = async () => {
    if (currentStep >= STEPS.length) return;
    const fieldsToValidate = STEP_VALIDATION_FIELDS[currentStep] || [];
    if (fieldsToValidate.length > 0) {
      const valid = await trigger(fieldsToValidate as any);
      if (!valid) {
        toast.error("Please fix the errors before proceeding.");
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const applyFieldFromSuggestion = useCallback((field: keyof ListingInput, value: unknown) => {
    setValue(field as Parameters<typeof setValue>[0], value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [setValue]);

  const applyVoiceField = (field: string, value: unknown) => {
    setValue(field as keyof z.input<typeof listingSchema>, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
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
        setError("photos", {
          type: "manual",
          message: getListingImageUploadError(null),
        });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        ...parsed,
        photos: finalImages,
        categorySpecificData: Object.keys(categorySpecificData).length > 0 ? categorySpecificData : undefined,
      };
      clearSavedDraft();
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("data", JSON.stringify(payload));
      submit(formData, { method: "post" });
    } catch (error) {
      const uploadErrorMessage = getListingImageUploadError(error);
      setError("photos", { type: "manual", message: uploadErrorMessage });
      toast.error(uploadErrorMessage);
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
    } catch (error) {
      toast.error(getListingDescriptionGenerationError(error));
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleQuickCreate = async () => {
    const values = getValues();
    const title = String(values.title || "").trim();
    const description = String(values.description || "").trim();
    const category = values.category || inferCategoryId(title, description, categories) || "";
    const condition = values.condition || inferCondition(title, description);

    if (imageFiles.length === 0) {
      setError("photos", {
        type: "manual",
        message: "At least one image is required",
      });
      return;
    }

    // Validate required category-specific fields (uses live-loaded fields from API)
    const catFields = categoryFields;
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
    const coords = await inferCoordinates(
      city,
      getValues("location.country") || "Nepal",
      values.location?.coordinates?.lat,
      values.location?.coordinates?.lng,
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
      photos: values.photos || [],
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
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              {t('common.back')}
            </button>
            <h1 className="text-xl font-bold text-foreground">
              {t('listings.create.title')}
            </h1>
            <div className="w-20" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Draft restore banner */}
        {hasDraft && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">
              {t('listings.create.draftFound', 'You have an unsaved draft. Would you like to continue where you left off?')}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={restoreDraft}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                {t('listings.create.restoreDraft', 'Restore Draft')}
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="rounded-md border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                {t('common.discard', 'Discard')}
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h2 className="text-lg font-semibold text-foreground">{t('listings.create.quickCreate', 'Quick Create (AI-assisted)')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('listings.create.quickCreateDesc', 'Fill a few basics, upload images, then click once. AI will auto-fill missing details.')}
          </p>
        </div>

        <div className="mb-8 rounded-lg border border-input bg-card p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-foreground">{t('listings.create.titleLabel')} *</label>
              <input
                {...register("title")}
                type="text"
                maxLength={200}
                placeholder="e.g., Sony A7 IV camera with 24-70 lens"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
              {errors.title && <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>}
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">{t('listings.create.descriptionLabel')} *</label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDescription}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                >
                  <Sparkles className={cn("w-3.5 h-3.5", isGeneratingDescription && "animate-spin")} />
                  {isGeneratingDescription ? t('listings.create.generating', 'Generating…') : t('listings.create.generateWithAI', 'Generate with AI')}
                </button>
              </div>
              <textarea
                {...register("description")}
                rows={4}
                maxLength={5000}
                placeholder="Describe the item and what is included..."
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{t('listings.create.categoryLabel')}</label>
              <select
                {...register("category")}
                data-testid="category-select"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              >
                <option value="">{loadingCategories ? t('listings.create.loadingCategories', 'Loading categories...') : t('listings.create.autoCategory', 'Auto (AI will choose)')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{t('listings.create.city')} *</label>
              <input
                {...register("location.city")}
                type="text"
                maxLength={80}
                placeholder="Kathmandu"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
              {errors.location?.city && (
                <p className="mt-1 text-sm text-destructive">{errors.location.city.message}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{t('listings.create.address')} *</label>
              <input
                {...register("location.address")}
                type="text"
                maxLength={200}
                placeholder="Durbar Marg"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{t('listings.create.state', 'State')} *</label>
              <input
                {...register("location.state")}
                type="text"
                maxLength={80}
                placeholder="Bagmati"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{t('listings.create.country', 'Country')} *</label>
              <input
                {...register("location.country")}
                type="text"
                maxLength={80}
                placeholder="Nepal"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{t('listings.create.zipCode')} *</label>
              <input
                {...register("location.postalCode")}
                type="text"
                maxLength={20}
                placeholder="44600"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Category-Specific Fields (Quick Create) */}
          <CategorySpecificFields
            fields={categoryFields}
            values={categorySpecificData}
            onChange={handleCategoryFieldChange}
          />

          <div className="mt-4">
            <div
              className="rounded-lg border-2 border-dashed border-input p-6 text-center transition-colors hover:border-primary/50"
              data-testid="image-upload-area"
            >
              <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="mb-3 text-sm text-muted-foreground">{t('listings.create.uploadAtLeastOne', 'Upload at least one image')}</p>
              <label className="inline-block cursor-pointer rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
                {t('listings.create.chooseFiles', 'Choose Files')}
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
              {isSubmitting ? t('listings.create.creating', 'Creating...') : t('listings.create.createNewListing', 'Create New Listing')}
            </UnifiedButton>
          </div>
        </div>

        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAdvancedEditor((prev) => !prev)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {showAdvancedEditor ? t('listings.create.hideAdvanced', 'Hide Advanced Manual Editor') : t('listings.create.showAdvanced', 'Open Advanced Manual Editor')}
          </button>
        </div>

        {showAdvancedEditor && (
          <div>
            {/* Completeness Progress Bar */}
            <div className="mb-6 p-4 bg-card rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{t('listings.create.completeness', 'Listing Completeness')}</span>
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
                  {t('listings.create.completeMoreFields', 'Complete more fields to improve visibility and attract more renters')}
                </p>
              )}
            </div>
            <div data-testid="step-indicator">
              <ListingStepIndicator steps={STEPS} currentStep={currentStep} />
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

        <div className="mb-4">
          <button
            data-testid="ai-panel-toggle"
            type="button"
            onClick={() => setShowAiPanel((prev) => !prev)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {showAiPanel ? t('listings.create.hideAiPanel', 'Hide AI Listing Assistant') : t('listings.create.showAiPanel', 'Open AI Listing Assistant')}
          </button>
        </div>

        {showAiPanel && (
          <AIListingAssistant
            listingData={draftValues}
            category={selectedCategorySlug ?? ""}
            onSuggestionApply={applyFieldFromSuggestion}
            className="mb-6"
          />
        )}

        {showAdvancedEditor && (
          <Form id="listing-form" method="post" onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" name="intent" value="create" />
          <Card>
            <CardContent className="p-8">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    {t('listings.create.basicInfo')}
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('listings.create.titleLabel')} *
                    </label>
                    <input
                      {...register("title")}
                      type="text"
                      maxLength={200}
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
                      {t('listings.create.descriptionLabel')} *
                    </label>
                    <textarea
                      {...register("description")}
                      rows={6}
                      maxLength={5000}
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
                      {t('listings.create.categoryLabel')} *
                    </label>
                  <select
                    {...register("category")}
                    data-testid="category-select"
                    className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                  >
                    <option value="">
                      {loadingCategories ? t('listings.create.loadingCategories', 'Loading categories...') : t('listings.create.selectCategory', 'Select a category')}
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
                    fields={categoryFields}
                    values={categorySpecificData}
                    onChange={handleCategoryFieldChange}
                  />
                </div>
              )}

              {/* Step 2: Pricing */}
              {currentStep === 2 && (
                <PricingStep
                  register={register}
                  errors={errors}
                  priceSuggestion={priceSuggestion}
                  onUseSuggestedPrice={(price) => setValue("basePrice", price)}
                />
              )}

              {/* Step 3: Location */}
              {currentStep === 3 && (
                <LocationStep register={register} errors={errors} />
              )}

              {/* Step 4: Details */}
              {currentStep === 4 && (
                <DetailsStep
                  register={register}
                  errors={errors}
                  showDeliveryFields={!!deliveryOptions?.delivery}
                />
              )}

              {/* Step 5: Images */}
              {currentStep === 5 && (
                <ImageUploadStep
                  imageUrls={imageUrls}
                  onUpload={handleImageUpload}
                  onRemove={removeImage}
                  error={errors.photos?.message}
                />
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
                    {t('listings.create.previous', 'Previous')}
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
                    {t('common.next')}
                  </UnifiedButton>
                ) : (
                  <UnifiedButton
                    type="submit"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    leftIcon={!isSubmitting ? <CheckCircle className="w-5 h-5" /> : undefined}
                    variant="success"
                  >
                    {isSubmitting ? t('listings.create.creating', 'Creating...') : t('listings.create.createListing', 'Create Listing')}
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
            {isSubmitting ? t('listings.create.creating', 'Creating...') : t('listings.create.createNewListing', 'Create New Listing')}
          </UnifiedButton>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
