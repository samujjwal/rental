import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { 
    Search, 
    Filter, 
    X, 
    Calendar, 
    Hash,
    Check,
    ChevronDown,
    SlidersHorizontal
} from "lucide-react";
import { Button } from "~/components/ui/Button";

export interface AdvancedFilterField {
    key: string;
    label: string;
    type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'boolean' | 'range';
    options?: Array<{ value: string; label: string; icon?: React.ReactNode }>;
    placeholder?: string;
    defaultValue?: any;
    min?: number;
    max?: number;
    step?: number;
    icon?: React.ReactNode;
    description?: string;
}

export interface AdvancedFilterGroup {
    title: string;
    fields: AdvancedFilterField[];
    collapsible?: boolean;
    defaultExpanded?: boolean;
}

interface AdvancedFiltersProps {
    groups: AdvancedFilterGroup[];
    initialFilters?: Record<string, any>;
    onFiltersChange?: (filters: Record<string, any>) => void;
    showActiveCount?: boolean;
    compactMode?: boolean;
    stickyFilters?: boolean;
    activeFiltersLayout?: 'grid' | 'inline';
}

export function AdvancedFilters({
    groups,
    initialFilters = {},
    onFiltersChange,
    showActiveCount = true,
    compactMode = false,
    stickyFilters = false,
    activeFiltersLayout = 'inline'
}: AdvancedFiltersProps) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
        groups.reduce((acc, group) => ({
            ...acc,
            [group.title]: group.defaultExpanded ?? !group.collapsible
        }), {})
    );
    const [showFilters, setShowFilters] = useState(false);
    const [showAddFilterMenu, setShowAddFilterMenu] = useState(false);

    // Initialize filters from URL params
    useEffect(() => {
        const urlFilters: Record<string, any> = {};
        groups.forEach(group => {
            group.fields.forEach(field => {
                const value = searchParams.get(field.key);
                if (value !== null) {
                    if (field.type === 'multiselect') {
                        urlFilters[field.key] = value ? value.split(',') : [];
                    } else if (field.type === 'boolean') {
                        urlFilters[field.key] = value === 'true';
                    } else if (field.type === 'number') {
                        urlFilters[field.key] = Number(value);
                    } else {
                        urlFilters[field.key] = value;
                    }
                }
            });
        });
        // Merge with existing filters to preserve state not in URL if any
        if (Object.keys(urlFilters).length > 0) {
            setFilters(prev => ({ ...prev, ...urlFilters }));
        }
    }, [searchParams, groups]);

    // Update URL when filters change
    const updateURL = (newFilters: Record<string, any>) => {
        const params = new URLSearchParams();

        // Preserve current page and limit
        const currentPage = searchParams.get('page');
        const currentLimit = searchParams.get('limit');
        
        Object.entries(newFilters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '' && 
                !(Array.isArray(value) && value.length === 0)) {
                if (Array.isArray(value)) {
                    params.set(key, value.join(','));
                } else {
                    params.set(key, String(value));
                }
            }
        });

        if (currentLimit) params.set('limit', currentLimit);
        // Reset to page 1 when filters change
        params.set('page', '1');

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        navigate(newUrl, { replace: true });
    };

    const handleFilterChange = (key: string, value: any) => {
        const newFilters = { ...filters, [key]: value };
        // Clean up empty values
        if (value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
            delete newFilters[key];
        }
        setFilters(newFilters);
        onFiltersChange?.(newFilters);
        updateURL(newFilters);
    };

    const handleReset = () => {
        setFilters({});
        onFiltersChange?.({});
        updateURL({});
    };

    const getActiveFiltersCount = () => {
        return Object.keys(filters).length;
    };

    const activeCount = getActiveFiltersCount();

    // Helper to get all fields flat for inline mode
    const allFields = groups.flatMap(g => g.fields);
    const searchField = allFields.find(f => f.key === 'search');
    const otherFields = allFields.filter(f => f.key !== 'search');
    
    // In inline mode, we only show fields that have a value in `filters` state (excluding search which is always visible)
    const activeFieldKeys = Object.keys(filters).filter(k => k !== 'search');

    const renderFieldInput = (field: AdvancedFilterField, minimal: boolean = false) => {
        const value = filters[field.key] ?? field.defaultValue ?? (field.type === 'multiselect' ? [] : '');
        const inlineInputClass = "bg-transparent border-none focus:ring-0 p-0 text-sm h-6 w-full min-w-[120px]";

        switch (field.type) {
            case 'text':
                if (minimal) {
                     return (
                        <input
                            type="text"
                            placeholder="Value..."
                            value={value}
                            autoFocus
                            onChange={(e) => handleFilterChange(field.key, e.target.value)}
                            className={inlineInputClass}
                        />
                    );
                }
                return (
                    <div className="relative w-full">
                        {field.icon || <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />}
                        <input
                            type="text"
                            placeholder={field.placeholder || `Search ${field.label}...`}
                            value={value}
                            onChange={(e) => handleFilterChange(field.key, e.target.value)}
                            className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                         {value && (
                            <button
                                onClick={() => handleFilterChange(field.key, '')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                );
            
             case 'select':
                 if (minimal) {
                    return (
                        <select
                            value={value}
                            onChange={(e) => handleFilterChange(field.key, e.target.value)}
                            className={`${inlineInputClass} bg-transparent`}
                        >
                            <option value="" disabled>Select...</option>
                            {field.options?.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    );
                }
                break;

             case 'multiselect':
                return (
                    <div className="flex flex-wrap gap-1">
                        {field.options?.map(option => {
                             const isSelected = Array.isArray(value) && value.includes(option.value);
                             return (
                                 <button
                                     key={option.value}
                                     onClick={() => {
                                         const currentValues = Array.isArray(value) ? value : [];
                                         const newValues = isSelected
                                             ? currentValues.filter(v => v !== option.value)
                                             : [...currentValues, option.value];
                                         handleFilterChange(field.key, newValues);
                                     }}
                                     className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                         isSelected 
                                         ? 'bg-blue-100 text-blue-700 font-medium' 
                                         : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                     }`}
                                 >
                                     {option.label}
                                 </button>
                             )
                        })}
                    </div>
                );
            case 'boolean':
                return (
                    <div className="flex gap-1">
                    <button onClick={() => handleFilterChange(field.key, true)} className={`px-2 py-0.5 rounded text-xs transition-colors ${value === true ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-600'}`}>Yes</button>
                    <button onClick={() => handleFilterChange(field.key, false)} className={`px-2 py-0.5 rounded text-xs transition-colors ${value === false ? 'bg-red-100 text-red-700 font-medium' : 'bg-gray-100 text-gray-600'}`}>No</button>
                    </div>
                );
        }
        // Fallback for minimal mode if not custom handled above, or full mode if calling renderField
        return null; 
    };

    const toggleGroup = (title: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    if (activeFiltersLayout === 'inline') {
        return (
            <div className={`space-y-4 ${stickyFilters ? 'sticky top-0 z-10 bg-white' : ''}`}>
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Primary Search Bar */}
                    {searchField && (
                        <div className="flex-1 min-w-[200px] max-w-md">
                            {renderFieldInput(searchField)}
                        </div>
                    )}
                    
                    {/* Add Filter Button */}
                    <div className="relative">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 border-dashed text-gray-500 hover:text-gray-900 gap-2"
                            onClick={() => setShowAddFilterMenu(!showAddFilterMenu)}
                        >
                            <Filter className="w-3.5 h-3.5" />
                            Add Filter
                        </Button>
                        
                        {/* Dropdown Menu */}
                        {showAddFilterMenu && (
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white border rounded-lg shadow-xl z-50 p-1">
                                <div className="text-xs font-semibold text-gray-500 px-2 py-1.5 uppercase tracking-wider">
                                    Available Filters
                                </div>
                                {otherFields.filter(f => !filters[f.key]).map(field => (
                                    <button
                                        key={field.key}
                                        onClick={() => {
                                            handleFilterChange(field.key, field.defaultValue ?? '');
                                            setShowAddFilterMenu(false);
                                        }}
                                        className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2"
                                    >
                                        {field.icon && <span className="text-gray-400">{field.icon}</span>}
                                        {field.label}
                                    </button>
                                ))}
                                {otherFields.every(f => filters[f.key] !== undefined) && (
                                    <div className="px-2 py-2 text-xs text-gray-400 text-center italic">
                                        All filters active
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Filters List */}
                {activeFieldKeys.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center bg-gray-50/50 p-2 rounded-lg border border-dashed border-gray-200">
                         <span className="text-xs font-medium text-gray-500 mr-1">Active:</span>
                        {activeFieldKeys.map(key => {
                            const field = otherFields.find(f => f.key === key);
                            if (!field) return null;

                            return (
                                <div key={key} className="flex items-center gap-2 bg-white border shadow-sm rounded-md px-2 py-1">
                                    <span className="text-xs font-medium text-gray-500">{field.label}:</span>
                                    <div className="min-w-[50px]">
                                         {renderFieldInput(field, true)}
                                    </div>
                                    <button 
                                        onClick={() => handleFilterChange(key, undefined)}
                                        className="text-gray-400 hover:text-red-500 ml-1"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                         <button 
                            onClick={handleReset}
                            className="text-xs text-red-600 hover:underline ml-2"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>
        );
    }
}
