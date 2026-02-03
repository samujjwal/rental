import { useState } from 'react';
import {
    Box,
    Toolbar,
    Typography,
    IconButton,
    Button,
    Checkbox,
    Menu,
    MenuItem,
    Chip,
} from '@mui/material';
import { Trash2, MoreVertical, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ConfirmDialog } from '~/components/ui/ConfirmDialog';
import { FadeIn } from '~/components/animations';

export interface BulkActionsToolbarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onDelete?: () => void;
    onStatusChange?: (status: string) => void;
    availableStatuses?: Array<{ value: string; label: string; icon?: React.ReactNode }>;
    isLoading?: boolean;
}

/**
 * BulkActionsToolbar Component
 * Toolbar for bulk operations on selected items
 */
export function BulkActionsToolbar({
    selectedCount,
    onClearSelection,
    onDelete,
    onStatusChange,
    availableStatuses = [],
    isLoading = false,
}: BulkActionsToolbarProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>('');

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleStatusChange = (status: string) => {
        setSelectedStatus(status);
        handleMenuClose();
        onStatusChange?.(status);
    };

    const handleDeleteClick = () => {
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        onDelete?.();
        setDeleteDialogOpen(false);
    };

    if (selectedCount === 0) return null;

    return (
        <FadeIn direction="down">
            <Toolbar
                sx={{
                    pl: { sm: 2 },
                    pr: { xs: 1, sm: 1 },
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    borderRadius: 1,
                    mb: 2,
                }}
            >
                <Typography sx={{ flex: '1 1 100%' }} variant="subtitle1" component="div">
                    {selectedCount} selected
                </Typography>

                {onStatusChange && availableStatuses.length > 0 && (
                    <>
                        <Button
                            color="inherit"
                            onClick={handleMenuOpen}
                            disabled={isLoading}
                            startIcon={<Clock size={16} />}
                        >
                            Change Status
                        </Button>
                        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                            {availableStatuses.map((status) => (
                                <MenuItem key={status.value} onClick={() => handleStatusChange(status.value)}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {status.icon}
                                        {status.label}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                )}

                {onDelete && (
                    <IconButton color="inherit" onClick={handleDeleteClick} disabled={isLoading}>
                        <Trash2 size={20} />
                    </IconButton>
                )}

                <IconButton color="inherit" onClick={onClearSelection}>
                    <X size={20} />
                </IconButton>

                <ConfirmDialog
                    open={deleteDialogOpen}
                    onClose={() => setDeleteDialogOpen(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Selected Items?"
                    message={`Are you sure you want to delete ${selectedCount} item${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`}
                    confirmText="Delete"
                    confirmColor="error"
                    isLoading={isLoading}
                />
            </Toolbar>
        </FadeIn>
    );
}

/**
 * Hook for managing bulk selection
 */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const isSelected = (id: string) => selected.has(id);

    const isAllSelected = items.length > 0 && selected.size === items.length;

    const isIndeterminate = selected.size > 0 && selected.size < items.length;

    const handleSelectAll = () => {
        if (isAllSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(items.map((item) => item.id)));
        }
    };

    const handleSelect = (id: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelected(newSelected);
    };

    const clearSelection = () => {
        setSelected(new Set());
    };

    const getSelectedItems = () => {
        return items.filter((item) => selected.has(item.id));
    };

    return {
        selected,
        selectedCount: selected.size,
        isSelected,
        isAllSelected,
        isIndeterminate,
        handleSelectAll,
        handleSelect,
        clearSelection,
        getSelectedItems,
    };
}

/**
 * BulkSelectCheckbox Component
 * Checkbox for selecting all items
 */
export interface BulkSelectCheckboxProps {
    checked: boolean;
    indeterminate?: boolean;
    onChange: () => void;
    disabled?: boolean;
}

export function BulkSelectCheckbox({
    checked,
    indeterminate = false,
    onChange,
    disabled = false,
}: BulkSelectCheckboxProps) {
    return (
        <Checkbox
            checked={checked}
            indeterminate={indeterminate}
            onChange={onChange}
            disabled={disabled}
            inputProps={{ 'aria-label': 'select all items' }}
        />
    );
}

/**
 * ItemSelectCheckbox Component
 * Checkbox for selecting individual items
 */
export interface ItemSelectCheckboxProps {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    ariaLabel?: string;
}

export function ItemSelectCheckbox({
    checked,
    onChange,
    disabled = false,
    ariaLabel = 'select item',
}: ItemSelectCheckboxProps) {
    return (
        <Checkbox
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            inputProps={{ 'aria-label': ariaLabel }}
            onClick={(e) => e.stopPropagation()}
        />
    );
}
