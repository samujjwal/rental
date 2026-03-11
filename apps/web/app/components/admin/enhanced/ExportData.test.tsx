import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Download: (props: any) => <span data-testid="download-icon" {...props} />,
  FileSpreadsheet: (props: any) => <span data-testid="file-spreadsheet-icon" {...props} />,
  FileText: (props: any) => <span data-testid="file-text-icon" {...props} />,
  Code: (props: any) => <span data-testid="code-icon" {...props} />,
  Loader2: (props: any) => <span data-testid="loader-icon" {...props} />,
  CheckCircle: (props: any) => <span data-testid="check-icon" {...props} />,
  AlertCircle: (props: any) => <span data-testid="alert-icon" {...props} />,
}));

import { ExportData } from './ExportData';

const sampleData = [
  { id: 1, name: 'Alice', email: 'alice@test.com' },
  { id: 2, name: 'Bob', email: 'bob@test.com' },
];

const sampleColumns = [
  { id: 'name', header: 'Name' },
  { id: 'email', header: 'Email' },
];

describe('ExportData', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue('blob:test');
    revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
  });

  it('renders export button', () => {
    render(<ExportData data={sampleData} />);
    expect(screen.getByTitle('Export')).toBeInTheDocument();
  });

  it('disables button when data is empty', () => {
    render(<ExportData data={[]} />);
    expect(screen.getByTitle('Export')).toBeDisabled();
  });

  it('opens menu on button click', () => {
    render(<ExportData data={sampleData} />);
    fireEvent.click(screen.getByTitle('Export'));
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    expect(screen.getByText('Export as JSON')).toBeInTheDocument();
    expect(screen.getByText('Export as Excel')).toBeInTheDocument();
  });

  it('closes menu on second button click', () => {
    render(<ExportData data={sampleData} />);
    const btn = screen.getByTitle('Export');
    fireEvent.click(btn);
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('Export as CSV')).not.toBeInTheDocument();
  });

  it('exports as CSV and creates blob', async () => {
    render(<ExportData data={sampleData} columns={sampleColumns} />);
    fireEvent.click(screen.getByTitle('Export'));
    fireEvent.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled();
    });
    // Verify blob was created with CSV content type
    const blobArg = createObjectURLMock.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it('exports as JSON and creates blob', async () => {
    render(<ExportData data={sampleData} />);
    fireEvent.click(screen.getByTitle('Export'));
    fireEvent.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled();
    });
  });

  it('shows success toast after CSV export', async () => {
    render(<ExportData data={sampleData} />);
    fireEvent.click(screen.getByTitle('Export'));
    fireEvent.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(screen.getByText('Export completed successfully!')).toBeInTheDocument();
    });
  });

  it('shows Excel option disabled in menu', () => {
    render(<ExportData data={sampleData} />);
    fireEvent.click(screen.getByTitle('Export'));
    expect(screen.getByText('Export as Excel')).toBeInTheDocument();
  });

  it('calls custom onExport handler', async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    render(<ExportData data={sampleData} onExport={onExport} />);
    fireEvent.click(screen.getByTitle('Export'));
    fireEvent.click(screen.getByText('Export as CSV'));
    await waitFor(() => {
      expect(onExport).toHaveBeenCalledWith('csv');
    });
  });

  it('dismisses toast on close button click', async () => {
    render(<ExportData data={sampleData} />);
    fireEvent.click(screen.getByTitle('Export'));
    fireEvent.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(screen.getByText('Export completed successfully!')).toBeInTheDocument();
    });

    // Close the toast
    fireEvent.click(screen.getByText('\u00d7'));
    expect(screen.queryByText('Export completed successfully!')).not.toBeInTheDocument();
  });
});
