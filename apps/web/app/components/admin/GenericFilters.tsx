import { useState, useEffect } from "react";
import { Form, useSearchParams, useNavigate } from "react-router";
import { Search, Filter, X, Calendar, Hash } from "lucide-react";
import { Button } from "~/components/ui/Button";

export interface FilterField {
    key: string;
    label: string;
    type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'boolean';
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    defaultValue?: any;
    validation?: {
        required?: boolean;
        min?: number;
        max?: number;
        pattern?: string;
    };
    dependencies?: {
        field: string;
        condition: (value: any, dependentValue: any) => boolean;
    }[];
}

export interface FilterGroup {
    title: string;
    fields: FilterField[];
    expanded?: boolean;
}

interface GenericFiltersProps {
    groups: FilterGroup[];
    initialFilters?: Record<string, any>;
    onFiltersChange?: (filters: Record<string, any>) => void;
    onReset?: () => void;
    showActiveFilters?: boolean;
    className?: string;
    collapsible?: boolean;
}

export function GenericFilters({
    groups,
    initialFilters = {},
    onFiltersChange,
    onReset,
    showActiveFilters = true,
    className = "",
    collapsible = false
}: GenericFiltersProps) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
        groups.reduce((acc, group) => ({
            ...acc,
            [group.title]: group.expanded ?? false
        }), {})
    );
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Initialize filters from URL params
    useEffect(() => {
        const urlFilters: Record<string, any> = {};
        groups.forEach(group => {
            group.fields.forEach(field => {
                const value = searchParams.get(field.key);
                if (value) {
                    if (field.type === 'multiselect') {
                        urlFilters[field.key] = value.split(',');
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
        setFilters(prev => ({ ...prev, ...urlFilters }));
    }, [searchParams, groups]);

    // Update URL when filters change
    const updateURL = (newFilters: Record<string, any>) => {
        const params = new URLSearchParams();

        Object.entries(newFilters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                if (Array.isArray(value)) {
                    params.set(key, value.join(','));
                } else {
                    params.set(key, String(value));
                }
            }
        });

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        navigate(newUrl, { replace: true });
    };

    const handleFilterChange = (key: string, value: any) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFiltersChange?.(newFilters);
        updateURL(newFilters);
    };

    const handleReset = () => {
        const emptyFilters = groups.reduce((acc, group) => {
            group.fields.forEach(field => {
                acc[field.key] = field.defaultValue ?? (field.type === 'multiselect' ? [] : '');
            });
            return acc;
        }, {} as Record<string, any>);

        setFilters(emptyFilters);
        onFiltersChange?.(emptyFilters);
        onReset?.();
        updateURL(emptyFilters);
    };

    const getActiveFiltersCount = () => {
        return Object.entries(filters).filter(([key, value]) => {
            const field = groups.flatMap(g => g.fields).find(f => f.key === key);
            if (!field) return false;

            const defaultValue = field.defaultValue ?? (field.type === 'multiselect' ? [] : '');
            return JSON.stringify(value) !== JSON.stringify(defaultValue);
        }).length;
    };

    const renderField = (field: FilterField) => {
        const value = filters[field.key] ?? field.defaultValue ?? (field.type === 'multiselect' ? [] : '');

        switch (field.type) {
            case 'text':
                return (
                    <div key={field.key} className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder={field.placeholder || `Search ${field.label}...`}
                            value={value}
                            onChange={(e) => handleFilterChange(field.key, e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                );

            case 'number':
                return (
                    <div key={field.key} className="relative">
                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="number"
                            placeholder={field.placeholder || `Enter ${field.label}...`}
                            value={value}
                            min={field.validation?.min}
                            max={field.validation?.max}
                            onChange={(e) => handleFilterChange(field.key, e.target.value ? Number(e.target.value) : '')}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                );

            case 'select':
                return (
                    <select
                        key={field.key}
                        value={value}
                        onChange={(e) => handleFilterChange(field.key, e.target.value)}
                        className="px-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All {field.label}</option>
                        {field.options?.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                );

            case 'multiselect':
                return (
                    <div key={field.key} className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                            {field.options?.map(option => (
                                <label
                                    key={option.value}
                                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={Array.isArray(value) && value.includes(option.value)}
                                        onChange={(e) => {
                                            const newValue = e.target.checked
                                                ? [...(Array.isArray(value) ? value : []), option.value]
                                                : (Array.isArray(value) ? value.filter(v => v !== option.value) : []);
                                            handleFilterChange(field.key, newValue);
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                    </div>
                );

            case 'boolean':
                return (
                    <select
                        key={field.key}
                        value={value?.toString() || ''}
                        onChange={(e) => handleFilterChange(field.key, e.target.value === 'true' ? true : e.target.value === 'false' ? false : '')}
                        className="px-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                );

            case 'date':
                return (
                    <div key={field.key} className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="date"
                            value={value || ''}
                            onChange={(e) => handleFilterChange(field.key, e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                );

            case 'daterange':
                return (
                    <div key={field.key} className="space-y-2">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="date"
                                placeholder="From"
                                value={value?.from || ''}
                                onChange={(e) => handleFilterChange(field.key, { ...value, from: e.target.value })}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="date"
                                placeholder="To"
                                value={value?.to || ''}
                                onChange={(e) => handleFilterChange(field.key, { ...value, to: e.target.value })}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const getActiveFilters = () => {
        const active: Array<{ key: string; label: string; value: string }> = [];

        groups.forEach(group => {
            group.fields.forEach(field => {
                const value = filters[field.key];
                if (value !== undefined && value !== null && value !== '' &&
                    (!Array.isArray(value) || value.length > 0)) {

                    let displayValue = '';
                    if (Array.isArray(value)) {
                        const labels = value.map(v =>
                            field.options?.find(opt => opt.value === v)?.label || v
                        );
                        displayValue = labels.join(', ');
                    } else if (field.type === 'boolean') {
                        displayValue = value ? 'Yes' : 'No';
                    } else if (field.type === 'daterange' && value?.from) {
                        displayValue = `${value.from} ${value.to ? `- ${value.to}` : ''}`;
                    } else {
                        displayValue = String(value);
                    }

                    active.push({
                        key: field.key,
                        label: field.label,
                        value: displayValue
                    });
                }
            });
        });

        return active;
    };

    const removeFilter = (key: string) => {
        const field = groups.flatMap(g => g.fields).find(f => f.key === key);
        const defaultValue = field?.defaultValue ?? (field?.type === 'multiselect' ? [] : '');
        handleFilterChange(key, defaultValue);
    };

    const activeFiltersCount = getActiveFiltersCount();
    const activeFilters = getActiveFilters();

    return (
        <div className={`bg-white p-4 rounded-lg border ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-medium text-gray-700">Filters</h3>
                    {activeFiltersCount > 0 && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            {activeFiltersCount}
                        </span>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    {activeFiltersCount > 0 && (
                        <Button variant="outline" size="sm" onClick={handleReset}>
                            <X className="w-3 h-3 mr-1" />
                            Reset
                        </Button>
                    )}
                    {collapsible && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            {showAdvanced ? 'Hide' : 'Show'} Advanced
                        </Button>
                    )}
                </div>
            </div>

            {/* Active Filters */}
            {showActiveFilters && activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Active:</span>
                    {activeFilters.map((filter) => (
                        <span
                            key={filter.key}
                            className="inline-flex items-center px-2 py-1 bg-white border border-gray-300 rounded text-sm"
                        >
                            <span className="font-medium">{filter.label}:</span>
                            <span className="ml-1">{filter.value}</span>
                            <button
                                onClick={() => removeFilter(filter.key)}
                                className="ml-1 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Filter Fields */}
            <div className="space-y-4">
                {groups.map((group) => (
                    <div key={group.title} className="border-b last:border-b-0 pb-4 last:pb-0">
                        {collapsible && (
                            <button
                                onClick={() => setExpandedGroups(prev => ({
                                    ...prev,
                                    [group.title]: !prev[group.title]
                                }))}
                                className="flex items-center justify-between w-full text-left mb-3"
                            >
                                <h4 className="text-sm font-medium text-gray-700">{group.title}</h4>
                                <span className="text-gray-400">
                                    {expandedGroups[group.title] ? '−' : '+'}
                                </span>
                            </button>
                        )}

                        {(!collapsible || expandedGroups[group.title]) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {group.fields.map(renderField)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
