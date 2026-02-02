/* eslint-disable react-refresh/only-export-components */

import { useLoaderData, Link } from "react-router";
import { Button, Badge, Card, CardContent } from "~/components/ui";
import { organizationsApi } from "~/lib/api/organizations";
import type { Organization } from "~/lib/api/organizations";

export async function clientLoader() {
  const { organizations } = await organizationsApi.getMyOrganizations();
  return { organizations };
}

export default function OrganizationsIndex() {
  const { organizations } = useLoaderData<typeof clientLoader>();

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "success";
      case "PENDING":
        return "warning";
      case "REJECTED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getTypeIcon = (businessType?: string | null) => {
    switch (businessType) {
      case "INDIVIDUAL":
        return "👤";
      case "LLC":
        return "🏢";
      case "CORPORATION":
        return "🏛️";
      case "PARTNERSHIP":
        return "🤝";
      default:
        return "🏢";
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              My Organizations
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage your organization accounts and team members
            </p>
          </div>
          <Link to="/organizations/create">
            <Button>Create Organization</Button>
          </Link>
        </div>

        {/* Organizations Grid */}
        {organizations.length === 0 ? (
          <Card className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              No organizations yet
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an organization to start managing listings as a team
            </p>
            <Link to="/organizations/create" className="mt-6 inline-block">
              <Button>Create Your First Organization</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org: Organization) => (
              <Card
                key={org.id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-6">
                  {/* Logo/Icon */}
                  <div className="flex items-center mb-4">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 bg-primary/10 rounded flex items-center justify-center text-2xl">
                        {getTypeIcon(org.businessType)}
                      </div>
                    )}
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {org.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        @{org.slug}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {org.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {org.description}
                    </p>
                  )}

                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant={getStatusVariant(org.verificationStatus || "PENDING")}>
                      {org.verificationStatus || "PENDING"}
                    </Badge>
                    {org.status !== "ACTIVE" && (
                      <Badge variant="secondary">{org.status}</Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted rounded">
                      <p className="text-2xl font-bold text-foreground">
                        {org._count?.members ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Members</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <p className="text-2xl font-bold text-foreground">
                        {org._count?.properties ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Listings</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <Link to={`/organizations/${org.id}`} className="flex-1">
                      <Button className="w-full">Manage</Button>
                    </Link>
                    <Link
                      to={`/organizations/${org.id}/listings`}
                      className="flex-1"
                    >
                      <Button variant="outlined" className="w-full">
                        Listings
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-foreground">
                About Organizations
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>
                  Organizations allow you to manage listings and collaborate
                  with team members. Each organization can have multiple members
                  with different roles and permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
