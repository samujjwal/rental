import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { Form, useNavigate, useActionData } from "react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    ArrowLeft,
    ArrowRight,
    Upload,
    X,
    CheckCircle,
} from "lucide-react";
import { listingApi } from "~/lib/api/listings";
import { listingSchema, type ListingInput } from "~/lib/validation/listing";
import { redirect } from "react-router";

export const meta: MetaFunction = () => {
    return [
        { title: "Create Listing - Universal Rental Portal" },
        { name: "description", content: "List your item for rent" },
    ];
};

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const data = JSON.parse(formData.get("data") as string);

    try {
        const listing = await listingApi.createListing(data);
        return redirect(`/listings/${listing.id}`);
    } catch (error: any) {
        return {
            error:
                error.response?.data?.message ||
                "Failed to create listing. Please try again.",
        };
    }
}

const STEPS = [
    { id: 1, name: "Basic Info", fields: ["title", "description", "category"] },
    {
        id: 2,
        name: "Pricing",
        fields: ["pricePerDay", "securityDeposit", "condition"],
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
    { id: 5, name: "Images", fields: ["images"] },
];

const CATEGORIES = [
    "Electronics",
    "Tools",
    "Sports",
    "Vehicles",
    "Photography",
    "Party & Events",
    "Outdoor & Camping",
    "Home & Garden",
];

export default function CreateListing() {
    const navigate = useNavigate();
    const actionData = useActionData<typeof action>();
    const [currentStep, setCurrentStep] = useState(1);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [imageFiles, setImageFiles] = useState<File[]>([]);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<ListingInput>({
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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length + imageFiles.length > 10) {
            alert("Maximum 10 images allowed");
            return;
        }

        const newImageUrls = files.map((file) => URL.createObjectURL(file));
        setImageUrls([...imageUrls, ...newImageUrls]);
        setImageFiles([...imageFiles, ...files]);
        setValue("images", [...imageUrls, ...newImageUrls]);
    };

    const removeImage = (index: number) => {
        const newImageUrls = imageUrls.filter((_, i) => i !== index);
        const newImageFiles = imageFiles.filter((_, i) => i !== index);
        setImageUrls(newImageUrls);
        setImageFiles(newImageFiles);
        setValue("images", newImageUrls);
    };

    const onSubmit = async (data: ListingInput) => {
        // In production, upload images to cloud storage first
        console.log("Form data:", data);

        const formData = new FormData();
        formData.append("data", JSON.stringify(data));

        // Submit form (will be handled by action)
        const form = document.getElementById("listing-form") as HTMLFormElement;
        form.submit();
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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back
                        </button>
                        <h1 className="text-xl font-bold text-gray-900">
                            Create New Listing
                        </h1>
                        <div className="w-20" />
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div
                                    className={`flex items-center justify-center w-10 h-10 rounded-full ${currentStep > step.id
                                            ? "bg-green-500 text-white"
                                            : currentStep === step.id
                                                ? "bg-primary-600 text-white"
                                                : "bg-gray-200 text-gray-600"
                                        }`}
                                >
                                    {currentStep > step.id ? (
                                        <CheckCircle className="w-6 h-6" />
                                    ) : (
                                        step.id
                                    )}
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div
                                        className={`w-full h-1 mx-2 ${currentStep > step.id ? "bg-green-500" : "bg-gray-200"
                                            }`}
                                        style={{ minWidth: "60px" }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        {STEPS.map((step) => (
                            <div key={step.id} className="text-center" style={{ width: "80px" }}>
                                {step.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {actionData?.error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{actionData.error}</p>
                    </div>
                )}

                {/* Form */}
                <Form
                    id="listing-form"
                    method="post"
                    onSubmit={handleSubmit(onSubmit)}
                    className="bg-white rounded-lg shadow-sm border p-8"
                >
                    {/* Step 1: Basic Info */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Basic Information
                            </h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Title *
                                </label>
                                <input
                                    {...register("title")}
                                    type="text"
                                    placeholder="e.g., Professional DSLR Camera Canon EOS 5D"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                                {errors.title && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.title.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description *
                                </label>
                                <textarea
                                    {...register("description")}
                                    rows={6}
                                    placeholder="Describe your item in detail..."
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                                {errors.description && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.description.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Category *
                                </label>
                                <select
                                    {...register("category")}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="">Select a category</option>
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                                {errors.category && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.category.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Pricing */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Pricing & Condition
                            </h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Price per Day * ($)
                                </label>
                                <input
                                    {...register("pricePerDay", { valueAsNumber: true })}
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    placeholder="25.00"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                                {errors.pricePerDay && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.pricePerDay.message}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Price per Week ($)
                                    </label>
                                    <input
                                        {...register("pricePerWeek", { valueAsNumber: true })}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="150.00"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Price per Month ($)
                                    </label>
                                    <input
                                        {...register("pricePerMonth", { valueAsNumber: true })}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="500.00"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Security Deposit * ($)
                                </label>
                                <input
                                    {...register("securityDeposit", { valueAsNumber: true })}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="100.00"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                                {errors.securityDeposit && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.securityDeposit.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Condition *
                                </label>
                                <select
                                    {...register("condition")}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 capitalize"
                                >
                                    <option value="">Select condition</option>
                                    <option value="new">New</option>
                                    <option value="like-new">Like New</option>
                                    <option value="good">Good</option>
                                    <option value="fair">Fair</option>
                                    <option value="poor">Poor</option>
                                </select>
                                {errors.condition && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.condition.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Location */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Location
                            </h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Address *
                                </label>
                                <input
                                    {...register("location.address")}
                                    type="text"
                                    placeholder="123 Main Street"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                                {errors.location?.address && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.location.address.message}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        City *
                                    </label>
                                    <input
                                        {...register("location.city")}
                                        type="text"
                                        placeholder="San Francisco"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                    {errors.location?.city && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.location.city.message}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        State *
                                    </label>
                                    <input
                                        {...register("location.state")}
                                        type="text"
                                        placeholder="CA"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Country *
                                    </label>
                                    <input
                                        {...register("location.country")}
                                        type="text"
                                        placeholder="USA"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                    {errors.location?.country && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.location.country.message}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Postal Code *
                                    </label>
                                    <input
                                        {...register("location.postalCode")}
                                        type="text"
                                        placeholder="94102"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Latitude *
                                    </label>
                                    <input
                                        {...register("location.coordinates.lat", {
                                            valueAsNumber: true,
                                        })}
                                        type="number"
                                        step="any"
                                        placeholder="37.7749"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Longitude *
                                    </label>
                                    <input
                                        {...register("location.coordinates.lng", {
                                            valueAsNumber: true,
                                        })}
                                        type="number"
                                        step="any"
                                        placeholder="-122.4194"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Details */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Rental Details
                            </h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Delivery Options *
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            {...register("deliveryOptions.pickup")}
                                            type="checkbox"
                                            className="w-4 h-4 text-primary-600 rounded"
                                        />
                                        <span>Pickup</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            {...register("deliveryOptions.delivery")}
                                            type="checkbox"
                                            className="w-4 h-4 text-primary-600 rounded"
                                        />
                                        <span>Delivery</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            {...register("deliveryOptions.shipping")}
                                            type="checkbox"
                                            className="w-4 h-4 text-primary-600 rounded"
                                        />
                                        <span>Shipping</span>
                                    </label>
                                </div>
                            </div>

                            {deliveryOptions?.delivery && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Delivery Radius (miles)
                                        </label>
                                        <input
                                            {...register("deliveryRadius", { valueAsNumber: true })}
                                            type="number"
                                            min="0"
                                            placeholder="10"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Delivery Fee ($)
                                        </label>
                                        <input
                                            {...register("deliveryFee", { valueAsNumber: true })}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="15.00"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Minimum Rental Period (days) *
                                    </label>
                                    <input
                                        {...register("minimumRentalPeriod", {
                                            valueAsNumber: true,
                                        })}
                                        type="number"
                                        min="1"
                                        placeholder="1"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                    {errors.minimumRentalPeriod && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.minimumRentalPeriod.message}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Maximum Rental Period (days)
                                    </label>
                                    <input
                                        {...register("maximumRentalPeriod", {
                                            valueAsNumber: true,
                                        })}
                                        type="number"
                                        min="1"
                                        placeholder="30"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cancellation Policy *
                                </label>
                                <select
                                    {...register("cancellationPolicy")}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 capitalize"
                                >
                                    <option value="flexible">Flexible</option>
                                    <option value="moderate">Moderate</option>
                                    <option value="strict">Strict</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Rental Rules
                                </label>
                                <textarea
                                    {...register("rules")}
                                    rows={4}
                                    placeholder="Any specific rules or requirements..."
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2">
                                    <input
                                        {...register("instantBooking")}
                                        type="checkbox"
                                        className="w-4 h-4 text-primary-600 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                        Allow instant booking (no approval needed)
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Images */}
                    {currentStep === 5 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Upload Images
                            </h2>

                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600 mb-4">
                                    Upload up to 10 images of your item
                                </p>
                                <label className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
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
                                        <div key={index} className="relative aspect-square">
                                            <img
                                                src={url}
                                                alt={`Upload ${index + 1}`}
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {errors.images && (
                                <p className="text-sm text-red-600">{errors.images.message}</p>
                            )}
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t">
                        {currentStep > 1 ? (
                            <button
                                type="button"
                                onClick={prevStep}
                                className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Previous
                            </button>
                        ) : (
                            <div />
                        )}

                        {currentStep < STEPS.length ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                            >
                                Next
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Create Listing
                            </button>
                        )}
                    </div>
                </Form>
            </div>
        </div>
    );
}
