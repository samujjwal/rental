import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import { Form, useNavigate, useLoaderData, useActionData } from "react-router";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Upload,
  X,
  Check,
  MapPin,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Trash2,
  Sparkles,
} from "lucide-react";
import { listingSchema, type ListingInput } from "~/lib/validation/listing";
import type { z } from "zod";
import { listingsApi } from "~/lib/api/listings";
import { uploadApi } from "~/lib/api/upload";
import { aiApi } from "~/lib/api/ai";
import { redirect } from "react-router";
import { toast } from "~/lib/toast";
import type { Listing, UpdateListingRequest } from "~/types/listing";
import { getUser } from "~/utils/auth";
import { RouteErrorBoundary, Dialog, DialogFooter } from "~/components/ui";
import { VoiceListingAssistant } from "~/components/listings/VoiceListingAssistant";
import { CategorySpecificFields } from "~/components/listings/CategorySpecificFields";
import { getCategoryFields } from "~/lib/category-fields";
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;

export const meta: MetaFunction = () => {
  return [{ title: "Edit Listing | GharBatai Rentals" }];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;
const isValidListingId = (value: string | undefined): value is string =>
  Boolean(value && (UUID_PATTERN.test(value) || SAFE_ID_PATTERN.test(value)));

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const listingId = params.id;
  if (!isValidListingId(listingId)) {
    return redirect("/dashboard");
  }

  try {
    const listing = await listingsApi.getListingById(listingId);
    if (user.role !== "admin" && listing.ownerId !== user.id) {
      return redirect(`/listings/${listingId}`);
    }
    return { listing };
  } catch (error) {
    console.error("Failed to load listing:", error);
    throw redirect("/dashboard");
  }
}

export async function clientAction({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const listingId = params.id;
  if (!isValidListingId(listingId)) {
    return { error: "Listing ID is required" };
  }

  try {
    const listing = await listingsApi.getListingById(listingId);
    if (user.role !== "admin" && listing.ownerId !== user.id) {
      return { error: "You are not authorized to edit this listing" };
    }
  } catch {
    return { error: "Listing not found" };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const parseJsonField = <T,>(key: string): T | null => {
    const value = formData.get(key);
    if (typeof value !== "string") return null;
    if (value.length > 100_000) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  };

  if (intent === "delete") {
    const deleteConfirmation = String(formData.get("deleteConfirmation") || "")
      .trim()
      .toUpperCase();
    if (deleteConfirmation !== "DELETE") {
      return { error: "Type DELETE to confirm listing deletion." };
    }
    try {
      await listingsApi.deleteListing(listingId);
      return redirect("/dashboard");
    } catch (error: unknown) {
      return {
        error:
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } })
                .response?.data?.message || "Failed to delete listing"
            : "Failed to delete listing",
      };
    }
  }

  if (intent && intent !== "update") {
    return { error: "Invalid action" };
  }

  // Handle update
  try {
    const location = parseJsonField<ListingInput["location"]>("location");
    const images = parseJsonField<string[]>("photos");
    const deliveryOptions =
      parseJsonField<ListingInput["deliveryOptions"]>("deliveryOptions");
    const features = parseJsonField<ListingInput["features"]>("features");

    if (!location || !images || !deliveryOptions || !features) {
      return { error: "Invalid listing payload" };
    }
    if (images.length > 10 || features.length > 100) {
      return { error: "Listing payload exceeds allowed size limits" };
    }

    const listingData: UpdateListingRequest = {
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      category: String(formData.get("category") ?? "").trim(),
      subcategory: String(formData.get("subcategory") ?? "").trim() || undefined,
      basePrice: Number(formData.get("basePrice")),
      pricePerWeek: formData.get("pricePerWeek")
        ? Number(formData.get("pricePerWeek"))
        : undefined,
      pricePerMonth: formData.get("pricePerMonth")
        ? Number(formData.get("pricePerMonth"))
        : undefined,
      condition: formData.get("condition") as ListingInput["condition"],
      location,
      images,
      instantBooking: formData.get("instantBooking") === "true",
      deliveryOptions,
      deliveryRadius: formData.get("deliveryRadius")
        ? Number(formData.get("deliveryRadius"))
        : undefined,
      deliveryFee: formData.get("deliveryFee")
        ? Number(formData.get("deliveryFee"))
        : undefined,
      securityDeposit: Number(formData.get("securityDeposit")),
      minimumRentalPeriod: Number(formData.get("minimumRentalPeriod")),
      maximumRentalPeriod: formData.get("maximumRentalPeriod")
        ? Number(formData.get("maximumRentalPeriod"))
        : undefined,
      cancellationPolicy:
        formData.get("cancellationPolicy") as ListingInput["cancellationPolicy"],
      rules: String(formData.get("rules") ?? "").trim() || undefined,
      features,
      categorySpecificData: parseJsonField<Record<string, unknown>>("categorySpecificData") || undefined,
    };

    if (!listingData.title || !listingData.description || !listingData.category) {
      return { error: "Title, description, and category are required" };
    }
    if (!Array.isArray(images) || images.length === 0) {
      return { error: "At least one image is required" };
    }
    const basePrice = Number(listingData.basePrice);
    const securityDeposit = Number(listingData.securityDeposit);
    const minimumRentalPeriod = Number(listingData.minimumRentalPeriod);
    if (
      !Number.isFinite(basePrice) ||
      !Number.isFinite(securityDeposit) ||
      !Number.isFinite(minimumRentalPeriod)
    ) {
      return { error: "Invalid pricing values" };
    }
    if (
      basePrice < 0 ||
      securityDeposit < 0 ||
      minimumRentalPeriod < 1
    ) {
      return { error: "Pricing values must be positive." };
    }

    const validation = listingSchema.safeParse({
      ...listingData,
      location,
      images,
      deliveryOptions,
      features,
    });
    if (!validation.success) {
      return {
        error: validation.error.issues[0]?.message || "Invalid listing details",
      };
    }

    const categories = await listingsApi.getCategories();
    const validCategoryIds = new Set((categories || []).map((category) => category.id));
    if (!validCategoryIds.has(validation.data.category)) {
      return { error: "Please select a valid listing category." };
    }

    await listingsApi.updateListing(listingId, validation.data);
    return redirect(`/listings/${listingId}`);
  } catch (error: unknown) {
    return {
      error:
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to update listing"
          : "Failed to update listing",
    };
  }
}

const STEPS = [
  { id: 1, name: "Basic Info" },
  { id: 2, name: "Pricing" },
  { id: 3, name: "Location" },
  { id: 4, name: "Details" },
  { id: 5, name: "Images" },
];

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like-new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible" },
  { value: "moderate", label: "Moderate" },
  { value: "strict", label: "Strict" },
];

export default function EditListing() {
  const { listing } = useLoaderData<{ listing: Listing }>();
  const actionData = useActionData<{ error?: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [imageItems, setImageItems] = useState<Array<{ url: string; file?: File }>>(
    ((listing.photos && listing.photos.length > 0 ? listing.photos : listing.images) || []).map((url) => ({ url }))
  );
  const imageItemsRef = useRef(imageItems);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<z.input<typeof listingSchema>>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: listing.title,
      description: listing.description,
      category:
        typeof listing.category === "string"
          ? listing.category
          : listing.category.id,
      subcategory: listing.subcategory || undefined,
      basePrice: listing.basePrice,
      pricePerWeek: listing.pricePerWeek || undefined,
      pricePerMonth: listing.pricePerMonth || undefined,
      condition: listing.condition,
      location: listing.location,
      images: (listing.photos && listing.photos.length > 0 ? listing.photos : listing.images) || [],
      instantBooking: listing.instantBooking,
      deliveryOptions: listing.deliveryOptions,
      deliveryRadius: listing.deliveryRadius || undefined,
      deliveryFee: listing.deliveryFee || undefined,
      securityDeposit: listing.securityDeposit,
      minimumRentalPeriod: listing.minimumRentalPeriod,
      maximumRentalPeriod: listing.maximumRentalPeriod || undefined,
      cancellationPolicy: listing.cancellationPolicy,
      rules: listing.rules || undefined,
      features: listing.features || [],
    },
  });

  const deliveryOptions = watch("deliveryOptions");
  const selectedCategoryId = watch("category");

  // Category-specific data state — initialized from listing
  const [categorySpecificData, setCategorySpecificData] = useState<Record<string, unknown>>(
    listing.categorySpecificData || {}
  );

  // Resolve selected category slug for dynamic fields
  const selectedCategorySlug = useMemo(() => {
    if (!selectedCategoryId) return listing.categorySlug || undefined;
    const cat = categories.find((c) => c.id === selectedCategoryId);
    return cat?.slug || listing.categorySlug || undefined;
  }, [selectedCategoryId, categories, listing.categorySlug]);

  const handleCategoryFieldChange = useCallback((key: string, value: unknown) => {
    setCategorySpecificData((prev) => ({ ...prev, [key]: value }));
  }, []);

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
            slug: category.slug,
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
    if (categories.length === 0) return;
    const currentCategory = getValues("category");
    if (categories.some((category) => category.id === currentCategory)) return;
    const match = categories.find(
      (category) => category.name === currentCategory || category.slug === currentCategory
    );
    if (match) {
      setValue("category", match.id);
    }
  }, [categories, getValues, setValue]);

  useEffect(() => {
    setValue(
      "photos",
      imageItems.map((item) => item.url)
    );
  }, [imageItems, setValue]);

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  useEffect(() => {
    return () => {
      imageItemsRef.current.forEach((item) => {
        if (item.file) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(
      (file) => file.type.startsWith("image/") && file.size <= MAX_IMAGE_FILE_SIZE
    );
    if (files.length + imageItems.length > 10) {
      toast.warning("You can only upload up to 10 images");
      return;
    }
    if (validFiles.length !== files.length) {
      toast.warning("Only image files up to 10MB are allowed.");
      return;
    }

    const newItems = validFiles.map((file) => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setImageItems((prev) => [...prev, ...newItems]);
  };

  const removeImage = (index: number) => {
    setImageItems((prev) => {
      const item = prev[index];
      if (item?.file) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const onSubmit = async (data: z.input<typeof listingSchema>) => {
    try {
      const parsed = listingSchema.parse(data) as ListingInput;
      let finalImages = imageItems.map((item) => item.url);
      const newFiles = imageItems
        .filter((item) => item.file)
        .map((item) => item.file) as File[];

      if (newFiles.length > 0) {
        const uploaded = await uploadApi.uploadImages(newFiles);
        let uploadIndex = 0;
        finalImages = imageItems.map((item) => {
          if (item.file) {
            const url = uploaded[uploadIndex]?.url;
            uploadIndex += 1;
            return url || item.url;
          }
          return item.url;
        });
      }

      const formData = new FormData();
      Object.keys(parsed).forEach((key) => {
        const value = parsed[key as keyof ListingInput];
        if (value !== undefined && value !== null) {
          if (typeof value === "object") {
            formData.append(
              key,
              JSON.stringify(key === "photos" ? finalImages : value)
            );
          } else {
            formData.append(key, String(value));
          }
        }
      });
      // Append category-specific data
      if (Object.keys(categorySpecificData).length > 0) {
        formData.append("categorySpecificData", JSON.stringify(categorySpecificData));
      }
      formData.append("intent", "update");

      const form = document.createElement("form");
      form.method = "POST";
      Array.from(formData.entries()).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value.toString();
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error("Failed to update listing:", error);
      toast.error("Failed to update listing. Please try again.");
    }
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("deleteConfirmation", deleteConfirmation.trim());

    const form = document.createElement("form");
    form.method = "POST";
    Array.from(formData.entries()).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value.toString();
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  const applyVoiceField = (field: string, value: unknown) => {
    setValue(field as keyof z.input<typeof listingSchema>, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/listings/${listing.id}`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Listing</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Edit Listing</h1>
            <button
              onClick={() => {
                setDeleteConfirmation("");
                setShowDeleteModal(true);
              }}
              className="flex items-center gap-2 text-destructive hover:text-destructive/80"
            >
              <Trash2 className="w-5 h-5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator */}
        <div className="mb-8" data-testid="step-indicator">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    currentStep > step.id
                      ? "bg-success text-success-foreground"
                      : currentStep === step.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-full h-1 mx-2 ${
                      currentStep > step.id ? "bg-success" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-600">
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

        {/* Error Message */}
        {actionData?.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {actionData.error}
          </div>
        )}

        <VoiceListingAssistant
          categories={categories.map((category) => ({ id: category.id, name: category.name }))}
          onSetField={applyVoiceField}
          onNextStep={nextStep}
          onPrevStep={prevStep}
        />

        {/* Form */}
        <Form
          method="post"
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-lg shadow-md p-6"
        >
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">
                  Basic Information
                </h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  {...register("title")}
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Professional DSLR Camera"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Description *
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
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
                    }}
                    disabled={isGeneratingDescription}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeneratingDescription ? "animate-spin" : ""}`} />
                    {isGeneratingDescription ? "Generating\u2026" : "Generate with AI"}
                  </button>
                </div>
                <textarea
                  {...register("description")}
                  rows={6}
                  maxLength={2000}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Describe your item in detail..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    {...register("category")}
                    data-testid="category-select"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">
                      {loadingCategories ? "Loading categories..." : "Select category"}
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.category.message}
                    </p>
                  )}
                  {categoriesError && (
                    <p className="mt-1 text-sm text-red-600">
                      {categoriesError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    {...register("subcategory")}
                    maxLength={80}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Cameras"
                  />
                </div>
              </div>

              {/* Category-Specific Fields */}
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
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">
                  Pricing & Condition
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Day *
                  </label>
                  <input
                    type="number"
                    {...register("basePrice", { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="50"
                  />
                  {errors.basePrice && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.basePrice.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Week
                  </label>
                  <input
                    type="number"
                    {...register("pricePerWeek", { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Month
                  </label>
                  <input
                    type="number"
                    {...register("pricePerMonth", { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Security Deposit *
                  </label>
                  <input
                    type="number"
                    {...register("securityDeposit", { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="100"
                  />
                  {errors.securityDeposit && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.securityDeposit.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition *
                  </label>
                  <select
                    {...register("condition")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select condition</option>
                    {CONDITIONS.map((cond) => (
                      <option key={cond.value} value={cond.value}>
                        {cond.label}
                      </option>
                    ))}
                  </select>
                  {errors.condition && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.condition.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Location</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  {...register("location.address")}
                  maxLength={200}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {errors.location?.address && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.location.address.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    {...register("location.city")}
                    maxLength={80}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.city && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.location.city.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    {...register("location.state")}
                    maxLength={80}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.state && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.location.state.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    {...register("location.country")}
                    maxLength={80}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.country && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.location.country.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    {...register("location.postalCode")}
                    maxLength={20}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.postalCode && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.location.postalCode.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    {...register("location.coordinates.lat", {
                      valueAsNumber: true,
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.coordinates?.lat && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.location.coordinates.lat.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    {...register("location.coordinates.lng", {
                      valueAsNumber: true,
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.coordinates?.lng && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.location.coordinates.lng.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Details */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Rental Details
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register("deliveryOptions.pickup")}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-700">Pickup available</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register("deliveryOptions.delivery")}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-700">
                      Delivery available
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register("deliveryOptions.shipping")}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-700">
                      Shipping available
                    </span>
                  </label>
                </div>
              </div>

              {deliveryOptions?.delivery && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Radius (miles)
                    </label>
                    <input
                      type="number"
                      {...register("deliveryRadius", { valueAsNumber: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Fee
                    </label>
                    <input
                      type="number"
                      {...register("deliveryFee", { valueAsNumber: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Rental Period (days) *
                  </label>
                  <input
                    type="number"
                    {...register("minimumRentalPeriod", {
                      valueAsNumber: true,
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.minimumRentalPeriod && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.minimumRentalPeriod.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Rental Period (days)
                  </label>
                  <input
                    type="number"
                    {...register("maximumRentalPeriod", {
                      valueAsNumber: true,
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cancellation Policy *
                </label>
                <select
                  {...register("cancellationPolicy")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select policy</option>
                  {CANCELLATION_POLICIES.map((policy) => (
                    <option key={policy.value} value={policy.value}>
                      {policy.label}
                    </option>
                  ))}
                </select>
                {errors.cancellationPolicy && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.cancellationPolicy.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rental Rules
                </label>
                <textarea
                  {...register("rules")}
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="List any rules or requirements..."
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register("instantBooking")}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-gray-700">
                    Enable instant booking
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Step 5: Images */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Images</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Images (max 10)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mb-2" />
                    <span className="text-gray-600">
                      Click to upload images
                    </span>
                    <span className="text-sm text-gray-500 mt-1">
                      {imageItems.length}/10 images uploaded
                    </span>
                  </label>
                </div>
                {errors.photos && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.photos.message}
                  </p>
                )}
              </div>

              {imageItems.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {imageItems.map((item, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={item.url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Previous
              </button>
            ) : (
              <div />
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Update Listing
              </button>
            )}
          </div>
        </Form>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={showDeleteModal}
        onClose={() => {
          setDeleteConfirmation("");
          setShowDeleteModal(false);
        }}
        title="Delete Listing"
        description="Are you sure you want to delete this listing? This action cannot be undone."
        size="md"
      >
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Type DELETE to confirm
          </label>
          <input
            type="text"
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            maxLength={20}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <button
            onClick={() => {
              setDeleteConfirmation("");
              setShowDeleteModal(false);
            }}
            className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteConfirmation.trim().toUpperCase() !== "DELETE"}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
          >
            Delete
          </button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

