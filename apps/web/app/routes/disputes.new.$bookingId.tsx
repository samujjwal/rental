import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigate,
  Link,
} from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  AlertCircle,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { disputesApi } from "~/lib/api/disputes";
import { bookingsApi } from "~/lib/api/bookings";
import { redirect } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "File a Dispute - Universal Rental Portal" },
    { name: "description", content: "File a dispute for your booking" },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const bookingId = params.bookingId;
  if (!bookingId) throw new Error("Booking ID is required");

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    return { booking };
  } catch (error) {
    throw new Error("Failed to load booking");
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const bookingId = params.bookingId;
  if (!bookingId) return { error: "Booking ID is required" };

  const formData = await request.formData();
  const type = formData.get("type") as string;
  const description = formData.get("description") as string;
  const requestedAmount = formData.get("requestedAmount") as string;

  try {
    const dispute = await disputesApi.createDispute({
      bookingId,
      type: type as any,
      description,
      requestedAmount: requestedAmount
        ? parseFloat(requestedAmount)
        : undefined,
    });

    return redirect(`/bookings/${bookingId}?disputeCreated=true`);
  } catch (error: any) {
    return {
      error:
        error.response?.data?.message ||
        "Failed to create dispute. Please try again.",
    };
  }
}

const DISPUTE_TYPES = [
  {
    value: "NON_DELIVERY",
    label: "Item Not Delivered",
    description: "You never received the item",
  },
  {
    value: "DAMAGED_ITEM",
    label: "Damaged Item",
    description: "Item was damaged before or during rental",
  },
  {
    value: "INCORRECT_ITEM",
    label: "Incorrect Item",
    description: "Received wrong item or not as described",
  },
  {
    value: "OVERCHARGE",
    label: "Overcharge",
    description: "You were charged more than agreed",
  },
  { value: "OTHER", label: "Other", description: "Other dispute reason" },
];

export default function DisputeNewRoute() {
  const { booking } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState("");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [evidence, setEvidence] = useState<File[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEvidence([...evidence, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setEvidence(evidence.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Booking
          </button>
          <h1 className="text-3xl font-bold text-foreground">File a Dispute</h1>
          <p className="mt-2 text-muted-foreground">
            Describe the issue with your booking. We'll review your dispute and
            work to resolve it fairly.
          </p>
        </div>

        {/* Booking Summary */}
        <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Booking Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Listing</p>
              <p className="text-sm font-medium text-foreground">
                {booking.listing?.title || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Booking ID</p>
              <p className="text-sm font-medium text-foreground">
                {booking.id}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-sm font-medium text-foreground">
                ${booking.totalPrice?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {booking.status}
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {actionData?.error && (
          <div className="mb-6 bg-destructive/10 border-l-4 border-destructive p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="ml-3">
                <p className="text-sm text-destructive">{actionData.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Form */}
        <Form method="post" className="bg-card rounded-lg shadow-sm p-6">
          <div className="space-y-6">
            {/* Dispute Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                What is the issue? *
              </label>
              <div className="space-y-3">
                {DISPUTE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={cn(
                      "flex items-start p-4 border rounded-lg cursor-pointer transition-all",
                      selectedType === type.value
                        ? "border-primary bg-primary/5"
                        : "border-input hover:border-border"
                    )}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type.value}
                      checked={selectedType === type.value}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="mt-1 h-4 w-4 text-primary focus:ring-ring"
                      required
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-foreground">
                        {type.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Describe the issue *
              </label>
              <textarea
                id="description"
                name="description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide as much detail as possible about what went wrong..."
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-primary"
                required
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Include specific details like dates, times, condition of item,
                communications with the other party, etc.
              </p>
            </div>

            {/* Requested Amount */}
            <div>
              <label
                htmlFor="requestedAmount"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Refund Amount Requested (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-muted-foreground sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="requestedAmount"
                  name="requestedAmount"
                  step="0.01"
                  min="0"
                  max={booking.totalPrice}
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-primary"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Maximum: ${booking.totalPrice?.toFixed(2) || "0.00"}
              </p>
            </div>

            {/* Evidence Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Supporting Evidence (Optional)
              </label>
              <div className="border-2 border-dashed border-input rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="evidence"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="evidence"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Files
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  Photos, documents, or screenshots (Max 10MB per file)
                </p>
              </div>

              {/* Uploaded Files */}
              {evidence.length > 0 && (
                <div className="mt-4 space-y-2">
                  {evidence.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center">
                        {file.type.startsWith("image/") ? (
                          <ImageIcon className="w-5 h-5 text-muted-foreground mr-3" />
                        ) : (
                          <FileText className="w-5 h-5 text-muted-foreground mr-3" />
                        )}
                        <span className="text-sm text-foreground">
                          {file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Important Note */}
            <div className="bg-warning/10 border-l-4 border-warning p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-warning" />
                <div className="ml-3">
                  <p className="text-sm text-warning-foreground">
                    <strong>Important:</strong> Disputes are taken seriously.
                    Please only file a dispute if you've attempted to resolve
                    the issue directly with the other party and were
                    unsuccessful.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-6 py-3 border border-input rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedType || !description}
                className="flex-1 px-6 py-3 bg-destructive text-destructive-foreground rounded-lg font-medium hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </Form>

        {/* Help Section */}
        <div className="mt-6 bg-primary/5 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary mb-2">
            Need Help?
          </h3>
          <p className="text-sm text-primary/80 mb-4">
            Before filing a dispute, try communicating with the other party
            through messages. Many issues can be resolved quickly through direct
            communication.
          </p>
          <Link
            to={`/messages?booking=${booking.id}`}
            className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
          >
            Go to Messages →
          </Link>
        </div>
      </div>
    </div>
  );
}
