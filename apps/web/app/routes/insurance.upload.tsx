import { Form, useLoaderData, useNavigate } from 'react-router';
import { useState } from 'react';
import type { Route } from './+types/insurance.upload';

export async function clientLoader() {
  // Get listing ID from URL params
  const listingId = new URLSearchParams(window.location.search).get('listingId');
  
  if (!listingId) {
    throw new Error('Listing ID required');
  }

  // Fetch insurance requirement
  const response = await fetch(`/api/insurance/listings/${listingId}/requirement`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  const requirement = await response.json();

  return { listingId, requirement };
}

export default function InsuranceUpload({ loaderData }: Route.ComponentProps) {
  const { listingId, requirement } = loaderData;
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      listingId,
      policyNumber: formData.get('policyNumber') as string,
      provider: formData.get('provider') as string,
      type: formData.get('type') as string,
      coverageAmount: parseInt(formData.get('coverageAmount') as string),
      effectiveDate: formData.get('effectiveDate') as string,
      expirationDate: formData.get('expirationDate') as string,
      documentUrl: formData.get('documentUrl') as string, // In production: upload file to S3 first
    };

    try {
      const response = await fetch('/api/insurance/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload insurance policy');
      }

      // Success - redirect to listings
      navigate('/listings?status=pending_insurance');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Upload Insurance Policy
          </h1>

          {/* Requirement Notice */}
          <div className={`mb-8 p-4 rounded-lg ${
            requirement.required ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {requirement.required ? (
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h3 className={`text-sm font-medium ${requirement.required ? 'text-yellow-800' : 'text-blue-800'}`}>
                  {requirement.required ? 'Insurance Required' : 'Insurance Optional'}
                </h3>
                <p className={`mt-1 text-sm ${requirement.required ? 'text-yellow-700' : 'text-blue-700'}`}>
                  {requirement.reason}
                </p>
                {requirement.required && (
                  <div className="mt-2 text-sm text-yellow-700">
                    <p><strong>Required Type:</strong> {requirement.type}</p>
                    <p><strong>Minimum Coverage:</strong> ${requirement.minimumCoverage.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Policy Number */}
            <div>
              <label htmlFor="policyNumber" className="block text-sm font-medium text-gray-700">
                Policy Number *
              </label>
              <input
                type="text"
                id="policyNumber"
                name="policyNumber"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="POL-123456"
              />
            </div>

            {/* Provider */}
            <div>
              <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
                Insurance Provider *
              </label>
              <input
                type="text"
                id="provider"
                name="provider"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="State Farm, Geico, etc."
              />
            </div>

            {/* Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Insurance Type *
              </label>
              <select
                id="type"
                name="type"
                required
                defaultValue={requirement.type || ''}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">Select type...</option>
                <option value="LIABILITY">Liability</option>
                <option value="COMPREHENSIVE">Comprehensive</option>
                <option value="COLLISION">Collision</option>
                <option value="DAMAGE">Damage Protection</option>
              </select>
            </div>

            {/* Coverage Amount */}
            <div>
              <label htmlFor="coverageAmount" className="block text-sm font-medium text-gray-700">
                Coverage Amount * (in dollars)
              </label>
              <input
                type="number"
                id="coverageAmount"
                name="coverageAmount"
                required
                min={requirement.minimumCoverage || 0}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={requirement.minimumCoverage?.toString() || '50000'}
              />
              {requirement.minimumCoverage && (
                <p className="mt-1 text-sm text-gray-500">
                  Minimum required: ${requirement.minimumCoverage.toLocaleString()}
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="effectiveDate" className="block text-sm font-medium text-gray-700">
                  Effective Date *
                </label>
                <input
                  type="date"
                  id="effectiveDate"
                  name="effectiveDate"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700">
                  Expiration Date *
                </label>
                <input
                  type="date"
                  id="expirationDate"
                  name="expirationDate"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Document Upload */}
            <div>
              <label htmlFor="documentUrl" className="block text-sm font-medium text-gray-700">
                Insurance Document * (PDF)
              </label>
              <div className="mt-1 flex items-center">
                <input
                  type="file"
                  id="document"
                  accept=".pdf"
                  required
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
              <input type="hidden" name="documentUrl" value="https://storage.example.com/temp.pdf" />
              <p className="mt-1 text-sm text-gray-500">
                Upload your insurance policy document (Max 10MB)
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-6">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
              >
                {uploading ? 'Uploading...' : 'Submit for Verification'}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Your insurance policy will be reviewed by our team</li>
              <li>Verification typically takes 24-48 hours</li>
              <li>You'll receive an email notification once verified</li>
              <li>Your listing will become active after insurance verification</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
