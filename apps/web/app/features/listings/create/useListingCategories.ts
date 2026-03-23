/**
 * useListingCategories
 *
 * Loads listing categories from the API on mount and exposes loading / error state.
 */
import { useState, useEffect } from "react";
import { listingsApi } from "~/lib/api/listings";
import { getListingCategoryLoadError } from "~/lib/listing-category-load-error";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface UseListingCategoriesResult {
  categories: Category[];
  loadingCategories: boolean;
  categoriesError: string;
}

export function useListingCategories(): UseListingCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await listingsApi.getCategories();
        if (!mounted) return;
        setCategories(
          (data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug ?? c.name.toLowerCase().replace(/\s+/g, "-"),
          })),
        );
      } catch (error) {
        if (!mounted) return;
        setCategories([]);
        setCategoriesError(getListingCategoryLoadError(error));
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, []);

  return { categories, loadingCategories, categoriesError };
}
