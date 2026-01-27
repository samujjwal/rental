/**
 * Filter Panel Component
 * 
 * A flexible filter component that supports:
 * - Multiple filter types (text, select, date range, number range)
 * - Dynamic filter configuration
 * - Preset management (save/load/delete)
 * - URL state synchronization
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Filter, X, Save, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/Button";

// ============= TYPES =============

export type FilterType = 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'numberrange' | 'boolean';

export interface FilterField {
    id: string;
    label: string;
    type: FilterType;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
    defaultValue?: any;
}

export interface FilterPreset {
    id: string;
    name: string;
    filters: Record<string, any>;
    createdAt: string;
}

export interface FilterPanelProps {
    fields: FilterField[];
    onFilterChange?: (filters: Record<string, any>) => void;
    presetStorageKey?: string;
    showPresets?: boolean;
    className?: string;
}

// ============= COMPONENT =============

export function FilterPanel({
    fields,
    onFilterChange,
    presetStorageKey = 'filter-presets',
    showPresets = true,
    className = '',
}: FilterPanelProps) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [filters, setFilters] = useState<Record<string, any>>(() => {
        const initial: Record<string, any> = {};
        fields.forEach(field => {
            const paramValue = searchParams.get(field.id);
            if (paramValue !== null) {
                initial[field.id] = paramValue;
            } else if (field.defaultValue !== undefined) {
                initial[field.id] = field.defaultValue;
            }
        });
        return initial;
    });

    const [presets, setPresets] = useState<FilterPreset[]>([]);
    const [showPresetMenu, setShowPresetMenu] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Load presets from localStorage
    useEffect(() => {
        if (!showPresets) return;
        try {
            const stored = localStorage.getItem(presetStorageKey);
            if (stored) {
                setPresets(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load filter presets:', error);
        }
    }, [presetStorageKey, showPresets]);

    // Update URL when filters change
    useEffect(() => {
        const params = new URLSearchParams(searchParams);

        // Update filter params
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.set(key, String(value));
            } else {
                params.delete(key);
            }
        });

        // Reset to page 1 when filters change
        params.set('page', '1');

        navigate(`?${params.toString()}`, { replace: true });
        onFilterChange?.(filters);
    }, [filters]);

    // ============= HANDLERS =============

    const updateFilter = (fieldId: string, value: any) => {
        setFilters(prev => ({
            ...prev,
            [fieldId]: value
        }));
    };

    const clearFilters = () => {
        setFilters({});
    };

    const savePreset = () => {
        const name = prompt('Enter a name for this filter preset:');
        if (!name) return;

        const newPreset: FilterPreset = {
            id: Date.now().toString(),
            name,
            filters: { ...filters },
            createdAt: new Date().toISOString()
        };

        const updated = [...presets, newPreset];
        setPresets(updated);
        localStorage.setItem(presetStorageKey, JSON.stringify(updated));
    };

    const applyPreset = (preset: FilterPreset) => {
        setFilters(preset.filters);
        setShowPresetMenu(false);
    };

    const deletePreset = (presetId: string) => {
        if (!confirm('Delete this filter preset?')) return;
        const updated = presets.filter(p => p.id !== presetId);
        setPresets(updated);
        localStorage.setItem(presetStorageKey, JSON.stringify(updated));
    };

    const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== null && v !== '');
    const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== null && v !== '').length;

    // ============= RENDER =============

    return (
        <div className={`bg-white rounded-lg border ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>

                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                            >
                                <X className="w-4 h-4 mr-1" />
                                Clear
                            </Button>
                        )}

                        {showPresets && (
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowPresetMenu(!showPresetMenu)}
                                >
                                    <Save className="w-4 h-4 mr-1" />
                                    Presets
                                </Button>

                                {showPresetMenu && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setShowPresetMenu(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg border shadow-lg z-20">
                                            {/* Save Current */}
                                            <div className="p-2 border-b">
                                                <button
                                                    onClick={savePreset}
                                                    disabled={!hasActiveFilters}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    Save current filters
                                                </button>
                                            </div>

                                            {/* Preset List */}
                                            {presets.length > 0 ? (
                                                <div className="p-2 max-h-64 overflow-y-auto">
                                                    {presets.map(preset => (
                                                        <div
                                                            key={preset.id}
                                                            className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 rounded group"
                                                        >
                                                            <button
                                                                onClick={() => applyPreset(preset)}
                                                                className="flex-1 text-left text-sm text-gray-700"
                                                            >
                                                                {preset.name}
                                                            </button>
                                                            <button
                                                                onClick={() => deletePreset(preset.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-4 text-center text-sm text-gray-500">
                                                    No saved presets
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Fields */}
            {showFilters && (
                <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {fields.map(field => (
                            <div key={field.id}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {field.label}
                                </label>
                                {renderFilterField(field, filters[field.id], (value) => updateFilter(field.id, value))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============= FIELD RENDERERS =============

function renderFilterField(
    field: FilterField,
    value: any,
    onChange: (value: any) => void
): React.ReactNode {
    switch (field.type) {
        case 'text':
            return (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            );

        case 'select':
            return (
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All</option>
                    {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            );

        case 'boolean':
            return (
                <select
                    value={value === undefined ? '' : value}
                    onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            );

        case 'date':
            return (
                <input
                    type="date"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            );

        case 'number':
            return (
                <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            );

        default:
            return null;
    }
}
