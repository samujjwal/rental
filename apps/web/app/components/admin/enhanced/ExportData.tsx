/**
 * Export Data Component
 * Export table data to CSV, Excel, JSON formats
 */

import React, { useState, useCallback } from 'react';
import {
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Tooltip,
    CircularProgress,
    Snackbar,
    Alert,
} from '@mui/material';
import {
    Download as DownloadIcon,
    TableChart as ExcelIcon,
    Description as CsvIcon,
    Code as JsonIcon,
} from '@mui/icons-material';

export type ExportFormat = 'csv' | 'excel' | 'json';

interface ExportDataProps {
    data: any[];
    columns?: Array<{ id: string; header: string }>;
    filename?: string;
    onExport?: (format: ExportFormat) => Promise<void> | void;
}

export const ExportData: React.FC<ExportDataProps> = ({
    data,
    columns,
    filename = 'export',
    onExport,
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [exporting, setExporting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    // Convert data to CSV
    const exportToCSV = useCallback(() => {
        try {
            const headers = columns?.map(col => col.header) || Object.keys(data[0] || {});
            const columnIds = columns?.map(col => col.id) || Object.keys(data[0] || {});

            const csvContent = [
                headers.join(','),
                ...data.map(row =>
                    columnIds.map(id => {
                        const value = row[id];
                        if (value === null || value === undefined) return '';
                        if (typeof value === 'string' && value.includes(',')) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    }).join(',')
                ),
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);

            setShowSuccess(true);
        } catch (error) {
            setErrorMessage('Failed to export CSV');
            setShowError(true);
        }
    }, [data, columns, filename]);

    // Convert data to JSON
    const exportToJSON = useCallback(() => {
        try {
            const jsonContent = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.json`;
            link.click();
            URL.revokeObjectURL(link.href);

            setShowSuccess(true);
        } catch (error) {
            setErrorMessage('Failed to export JSON');
            setShowError(true);
        }
    }, [data, filename]);

    // Handle export
    const handleExport = useCallback(async (format: ExportFormat) => {
        handleClose();
        setExporting(true);

        try {
            if (onExport) {
                await onExport(format);
            } else {
                switch (format) {
                    case 'csv':
                        exportToCSV();
                        break;
                    case 'json':
                        exportToJSON();
                        break;
                    case 'excel':
                        // Excel export would require a library like xlsx
                        setErrorMessage('Excel export requires additional setup');
                        setShowError(true);
                        break;
                }
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Export failed');
            setShowError(true);
        } finally {
            setExporting(false);
        }
    }, [onExport, exportToCSV, exportToJSON]);

    return (
        <>
            <Tooltip title="Export">
                <IconButton
                    onClick={handleClick}
                    disabled={exporting || data.length === 0}
                    size="small"
                >
                    {exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
                </IconButton>
            </Tooltip>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <MenuItem onClick={() => handleExport('csv')}>
                    <ListItemIcon>
                        <CsvIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Export as CSV</ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleExport('json')}>
                    <ListItemIcon>
                        <JsonIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Export as JSON</ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleExport('excel')} disabled>
                    <ListItemIcon>
                        <ExcelIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Export as Excel</ListItemText>
                </MenuItem>
            </Menu>

            <Snackbar
                open={showSuccess}
                autoHideDuration={3000}
                onClose={() => setShowSuccess(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" onClose={() => setShowSuccess(false)}>
                    Export completed successfully!
                </Alert>
            </Snackbar>

            <Snackbar
                open={showError}
                autoHideDuration={5000}
                onClose={() => setShowError(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="error" onClose={() => setShowError(false)}>
                    {errorMessage}
                </Alert>
            </Snackbar>
        </>
    );
};

export default ExportData;
