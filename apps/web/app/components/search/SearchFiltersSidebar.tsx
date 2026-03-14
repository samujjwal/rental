import { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LocationAutocomplete } from "~/components/search/LocationAutocomplete";

interface Category {
  id: string;
  name: string;
}

interface SearchFiltersSidebarProps {
  categories: Category[];
  searchParams: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    instantBooking?: boolean;
    delivery?: boolean;
  };
  urlSearchParams: URLSearchParams;
  locationValue: string;
  conditions: string[];
  maxLocationLength: number;
  onLocationChange: (value: string) => void;
  onLocationSelect: (suggestion: {
    shortLabel: string;
    coordinates: { lat: number; lon: number };
  }) => void;
  onFilterChange: (key: string, value: string) => void;
  onApplyLocation: (
    label: string,
    coords?: { lat: number; lon: number }
  ) => void;
  onClearPin: () => void;
  onClearAll?: () => void;
  onClose: () => void;
}

const humanizeCondition = (value: unknown): string => {
  const text = typeof value === "string" ? value : "";
  return (text || "").replace("-", " ");
};

const activeFiltersInSecondary = (props: SearchFiltersSidebarProps) =>
  Boolean(
    (props.urlSearchParams.get('radius') && props.urlSearchParams.get('radius') !== '25') ||
    props.searchParams.condition ||
    props.searchParams.instantBooking ||
    props.searchParams.delivery
  );

export function SearchFiltersSidebar({
  categories,
  searchParams,
  urlSearchParams,
  locationValue,
  conditions,
  maxLocationLength,
  onLocationChange,
  onLocationSelect,
  onFilterChange,
  onApplyLocation,
  onClearPin,
  onClearAll,
  onClose,
}: SearchFiltersSidebarProps) {
  const { t } = useTranslation();
  const hasSecondaryActive = activeFiltersInSecondary({ categories, searchParams, urlSearchParams, locationValue, conditions, maxLocationLength, onLocationChange, onLocationSelect, onFilterChange, onApplyLocation, onClearPin, onClearAll, onClose });
  const [showMore, setShowMore] = useState(hasSecondaryActive);
  const hasAnyActiveFilter = Boolean(
    searchParams.category ||
    searchParams.minPrice ||
    searchParams.maxPrice ||
    hasSecondaryActive ||
    locationValue
  );
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] overflow-y-auto bg-card shadow-xl md:relative md:inset-auto md:z-auto md:w-64 md:shadow-none md:shrink-0">
        <div className="bg-card rounded-lg md:shadow-sm md:border p-6 md:sticky md:top-24">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">{t("search.filters")}</h3>
            <div className="flex items-center gap-2">
              {hasAnyActiveFilter && onClearAll && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs text-primary hover:text-primary/80 font-medium underline-offset-2 hover:underline"
                >
                  {t("search.clearAll", "Clear all")}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="md:hidden p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("search.category")}
            </label>
            <select
              value={searchParams.category || ""}
              onChange={(e) => onFilterChange("category", e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="">{t("search.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("search.location")}
            </label>
            <LocationAutocomplete
              value={locationValue}
              onChange={(value) =>
                onLocationChange(value.slice(0, maxLocationLength))
              }
              onSelect={(suggestion) => {
                onLocationSelect(suggestion);
              }}
              inputClassName="py-2.5 text-sm pr-4"
              biasZoom={8}
              biasScale={0.6}
              layer="city"
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onApplyLocation(locationValue)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("search.applyLocation")}
              </button>
              {(urlSearchParams.get("lat") ||
                urlSearchParams.get("lng")) && (
                <button
                  type="button"
                  onClick={onClearPin}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("search.clearPin")}
                </button>
              )}
            </div>
          </div>

          {/* Price Range - always visible */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("search.priceRangePerDay")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="minPrice"
                placeholder={t("search.min")}
                value={searchParams.minPrice || ""}
                onChange={(e) => onFilterChange("minPrice", e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="number"
                name="maxPrice"
                placeholder={t("search.max")}
                value={searchParams.maxPrice || ""}
                onChange={(e) => onFilterChange("maxPrice", e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
              />
            </div>
          </div>

          {/* Radius */}
          <div className={showMore ? "mb-6" : "hidden"}>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("search.searchRadius")}
            </label>
            <select
              value={urlSearchParams.get("radius") || "25"}
              onChange={(e) => onFilterChange("radius", e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="5">{t("search.kmRadius", { km: 5 })}</option>
              <option value="10">{t("search.kmRadius", { km: 10 })}</option>
              <option value="25">{t("search.kmRadius", { km: 25 })}</option>
              <option value="50">{t("search.kmRadius", { km: 50 })}</option>
              <option value="100">{t("search.kmRadius", { km: 100 })}</option>
            </select>
          </div>

          {/* Condition */}
          <div className={showMore ? "mb-6" : "hidden"}>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("search.condition")}
            </label>
            <select
              value={searchParams.condition || ""}
              onChange={(e) => onFilterChange("condition", e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background capitalize focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="">{t("search.anyCondition")}</option>
              {conditions.map((cond) => (
                <option key={cond} value={cond}>
                  {humanizeCondition(cond)}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filters */}
          <div className={showMore ? "space-y-3" : "hidden"}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={searchParams.instantBooking === true}
                onChange={(e) =>
                  onFilterChange(
                    "instantBooking",
                    e.target.checked ? "true" : ""
                  )
                }
                className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
              />
              <span className="text-sm text-foreground">{t("search.instantBooking")}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={searchParams.delivery === true}
                onChange={(e) =>
                  onFilterChange(
                    "delivery",
                    e.target.checked ? "true" : ""
                  )
                }
                className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
              />
              <span className="text-sm text-foreground">
                {t("search.deliveryAvailable")}
              </span>
            </label>
          </div>

          {/* More / Fewer filters toggle */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="mt-4 w-full flex items-center justify-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {showMore ? (
              <><ChevronUp className="w-4 h-4" /> {t('search.fewerFilters', 'Fewer filters')}</>
            ) : (
              <><ChevronDown className="w-4 h-4" /> {t('search.moreFilters', 'More filters')}{hasSecondaryActive ? <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">&bull;</span> : null}</>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
