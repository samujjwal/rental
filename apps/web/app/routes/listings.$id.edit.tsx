import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { Form, useNavigate, useLoaderData, useActionData } from 'react-router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
} from 'lucide-react';
import { listingSchema, type ListingInput } from '~/lib/validation/listing';
import { listingsApi } from '~/lib/api/listings';
import { redirect } from 'react-router';
import type { Listing } from '~/types/listing';

export const meta: MetaFunction = () => {
  return [{ title: 'Edit Listing | GharBatai Rentals' }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const listingId = params.id;
  if (!listingId) {
    throw redirect('/dashboard');
  }

  try {
    const listing = await listingsApi.getListingById(listingId);
    return { listing };
  } catch (error) {
    console.error('Failed to load listing:', error);
    throw redirect('/dashboard');
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const listingId = params.id;
  if (!listingId) {
    return { error: 'Listing ID is required' };
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    try {
      await listingsApi.deleteListing(listingId);
      return redirect('/dashboard');
    } catch (error: any) {
      return { error: error.response?.data?.message || 'Failed to delete listing' };
    }
  }

  // Handle update
  try {
    const listingData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      subcategory: formData.get('subcategory') as string,
      pricePerDay: Number(formData.get('pricePerDay')),
      pricePerWeek: formData.get('pricePerWeek') ? Number(formData.get('pricePerWeek')) : undefined,
      pricePerMonth: formData.get('pricePerMonth') ? Number(formData.get('pricePerMonth')) : undefined,
      condition: formData.get('condition') as string,
      location: JSON.parse(formData.get('location') as string),
      images: JSON.parse(formData.get('images') as string),
      instantBooking: formData.get('instantBooking') === 'true',
      deliveryOptions: JSON.parse(formData.get('deliveryOptions') as string),
      deliveryRadius: formData.get('deliveryRadius') ? Number(formData.get('deliveryRadius')) : undefined,
      deliveryFee: formData.get('deliveryFee') ? Number(formData.get('deliveryFee')) : undefined,
      securityDeposit: Number(formData.get('securityDeposit')),
      minimumRentalPeriod: Number(formData.get('minimumRentalPeriod')),
      maximumRentalPeriod: formData.get('maximumRentalPeriod')
        ? Number(formData.get('maximumRentalPeriod'))
        : undefined,
      cancellationPolicy: formData.get('cancellationPolicy') as string,
      rules: formData.get('rules') as string,
      features: JSON.parse(formData.get('features') as string),
    };

    await listingsApi.updateListing(listingId, listingData);
    return redirect(`/listings/${listingId}`);
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Failed to update listing' };
  }
}

const STEPS = [
  { id: 1, name: 'Basic Info' },
  { id: 2, name: 'Pricing' },
  { id: 3, name: 'Location' },
  { id: 4, name: 'Details' },
  { id: 5, name: 'Images' },
];

const CATEGORIES = [
  'Electronics',
  'Vehicles',
  'Tools & Equipment',
  'Sports & Outdoors',
  'Party & Events',
  'Home & Garden',
  'Fashion & Accessories',
  'Other',
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

const CANCELLATION_POLICIES = ['Flexible', 'Moderate', 'Strict'];

export default function EditListing() {
  const { listing } = useLoaderData<{ listing: Listing }>();
  const actionData = useActionData<{ error?: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [imageUrls, setImageUrls] = useState<string[]>(listing.images || []);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ListingInput>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: listing.title,
      description: listing.description,
      category: listing.category,
      subcategory: listing.subcategory,
      pricePerDay: listing.pricePerDay,
      pricePerWeek: listing.pricePerWeek,
      pricePerMonth: listing.pricePerMonth,
      condition: listing.condition,
      location: listing.location,
      images: listing.images,
      instantBooking: listing.instantBooking,
      deliveryOptions: listing.deliveryOptions,
      deliveryRadius: listing.deliveryRadius,
      deliveryFee: listing.deliveryFee,
      securityDeposit: listing.securityDeposit,
      minimumRentalPeriod: listing.minimumRentalPeriod,
      maximumRentalPeriod: listing.maximumRentalPeriod,
      cancellationPolicy: listing.cancellationPolicy,
      rules: listing.rules,
      features: listing.features || [],
    },
  });

  const deliveryOptions = watch('deliveryOptions');

  useEffect(() => {
    setValue('images', imageUrls);
  }, [imageUrls, setValue]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageUrls.length > 10) {
      alert('You can only upload up to 10 images');
      return;
    }

    const newImageUrls = files.map((file) => URL.createObjectURL(file));
    setImageUrls([...imageUrls, ...newImageUrls]);
    setImageFiles([...imageFiles, ...files]);
  };

  const removeImage = (index: number) => {
    const newImageUrls = imageUrls.filter((_, i) => i !== index);
    const newImageFiles = imageFiles.filter((_, i) => i !== index);
    setImageUrls(newImageUrls);
    setImageFiles(newImageFiles);
  };

  const onSubmit = async (data: ListingInput) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      const value = data[key as keyof ListingInput];
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });
    formData.append('intent', 'update');

    const form = document.createElement('form');
    form.method = 'POST';
    Array.from(formData.entries()).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value.toString();
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.append('intent', 'delete');

    const form = document.createElement('form');
    form.method = 'POST';
    Array.from(formData.entries()).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value.toString();
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
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
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-5 h-5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : currentStep === step.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-600'
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
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            {STEPS.map((step) => (
              <div key={step.id} className="text-center" style={{ width: '80px' }}>
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

        {/* Form */}
        <Form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-md p-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  {...register('title')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Professional DSLR Camera"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  {...register('description')}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Describe your item in detail..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    {...register('category')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    {...register('subcategory')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Cameras"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Pricing */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Pricing & Condition</h2>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Day *
                  </label>
                  <input
                    type="number"
                    {...register('pricePerDay', { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="50"
                  />
                  {errors.pricePerDay && (
                    <p className="mt-1 text-sm text-red-600">{errors.pricePerDay.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Week
                  </label>
                  <input
                    type="number"
                    {...register('pricePerWeek', { valueAsNumber: true })}
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
                    {...register('pricePerMonth', { valueAsNumber: true })}
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
                    {...register('securityDeposit', { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="100"
                  />
                  {errors.securityDeposit && (
                    <p className="mt-1 text-sm text-red-600">{errors.securityDeposit.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition *
                  </label>
                  <select
                    {...register('condition')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select condition</option>
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                  {errors.condition && (
                    <p className="mt-1 text-sm text-red-600">{errors.condition.message}</p>
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
                  {...register('location.address')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {errors.location?.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.location.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    {...register('location.city')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.location.city.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    {...register('location.state')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.state && (
                    <p className="mt-1 text-sm text-red-600">{errors.location.state.message}</p>
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
                    {...register('location.country')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errors.location?.country && (
                    <p className="mt-1 text-sm text-red-600">{errors.location.country.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    {...register('location.postalCode')}
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
                    {...register('location.coordinates.lat', { valueAsNumber: true })}
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
                    {...register('location.coordinates.lng', { valueAsNumber: true })}
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
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Rental Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('deliveryOptions.pickup')}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-700">Pickup available</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('deliveryOptions.delivery')}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-700">Delivery available</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('deliveryOptions.shipping')}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-700">Shipping available</span>
                  </label>
                </div>
              </div>

              {deliveryOptions?.delivery && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Radius (km)
                    </label>
                    <input
                      type="number"
                      {...register('deliveryRadius', { valueAsNumber: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Fee
                    </label>
                    <input
                      type="number"
                      {...register('deliveryFee', { valueAsNumber: true })}
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
                    {...register('minimumRentalPeriod', { valueAsNumber: true })}
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
                    {...register('maximumRentalPeriod', { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cancellation Policy *
                </label>
                <select
                  {...register('cancellationPolicy')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select policy</option>
                  {CANCELLATION_POLICIES.map((policy) => (
                    <option key={policy} value={policy}>
                      {policy}
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
                  {...register('rules')}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="List any rules or requirements..."
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('instantBooking')}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-gray-700">Enable instant booking</span>
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
                    <span className="text-gray-600">Click to upload images</span>
                    <span className="text-sm text-gray-500 mt-1">
                      {imageUrls.length}/10 images uploaded
                    </span>
                  </label>
                </div>
                {errors.images && (
                  <p className="mt-1 text-sm text-red-600">{errors.images.message}</p>
                )}
              </div>

              {imageUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
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
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete Listing</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this listing? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
