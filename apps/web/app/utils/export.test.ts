import { describe, it, expect, vi, beforeEach } from 'vitest';

import { toCsv, downloadFile, exportToCsv } from './export';

describe('toCsv', () => {
  const columns = [
    { header: 'Name', accessor: (r: any) => r.name },
    { header: 'Age', accessor: (r: any) => r.age },
    { header: 'City', accessor: (r: any) => r.city },
  ];

  const rows = [
    { name: 'Alice', age: 30, city: 'Kathmandu' },
    { name: 'Bob', age: 25, city: 'Pokhara' },
  ];

  it('generates CSV with headers', () => {
    const csv = toCsv(rows, columns);
    expect(csv.startsWith('Name,Age,City')).toBe(true);
  });

  it('generates CSV with correct rows', () => {
    const csv = toCsv(rows, columns);
    const lines = csv.split('\r\n');
    expect(lines.length).toBe(3);
    expect(lines[1]).toBe('Alice,30,Kathmandu');
    expect(lines[2]).toBe('Bob,25,Pokhara');
  });

  it('escapes values with commas', () => {
    const data = [{ name: 'Smith, John', age: 40, city: 'NYC' }];
    const csv = toCsv(data, columns);
    expect(csv).toContain('"Smith, John"');
  });

  it('escapes values with quotes', () => {
    const data = [{ name: 'She said "hello"', age: 20, city: 'LA' }];
    const csv = toCsv(data, columns);
    expect(csv).toContain('"She said ""hello"""');
  });

  it('escapes values with newlines', () => {
    const data = [{ name: 'Line1\nLine2', age: 20, city: 'SF' }];
    const csv = toCsv(data, columns);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('handles null and undefined values', () => {
    const data = [{ name: null, age: undefined, city: 'Biratnagar' }];
    const csv = toCsv(data, columns);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe(',,Biratnagar');
  });

  it('handles empty rows', () => {
    const csv = toCsv([], columns);
    expect(csv).toBe('Name,Age,City');
  });

  it('handles boolean values', () => {
    const cols = [{ header: 'Active', accessor: (r: any) => r.active }];
    const csv = toCsv([{ active: true }, { active: false }], cols);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('true');
    expect(lines[2]).toBe('false');
  });
});

describe('downloadFile', () => {
  let mockLink: any;

  beforeEach(() => {
    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockReturnValue(mockLink);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(mockLink);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('creates a download link and clicks it', () => {
    downloadFile('test content', 'test.csv');
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('sets the correct filename', () => {
    downloadFile('content', 'report.csv');
    expect(mockLink.download).toBe('report.csv');
  });

  it('creates blob URL', () => {
    downloadFile('content', 'file.csv');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('revokes blob URL after download', () => {
    downloadFile('content', 'file.csv');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('appends and removes link from body', () => {
    downloadFile('content', 'file.csv');
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });
});

describe('exportToCsv', () => {
  let mockLink: any;

  beforeEach(() => {
    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockReturnValue(mockLink);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(mockLink);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('generates and downloads CSV', () => {
    const columns = [{ header: 'Name', accessor: (r: any) => r.name }];
    exportToCsv([{ name: 'Test' }], columns, 'export');
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('includes date suffix in filename', () => {
    const columns = [{ header: 'Name', accessor: (r: any) => r.name }];
    exportToCsv([{ name: 'Test' }], columns, 'report');
    const dateSuffix = new Date().toISOString().slice(0, 10);
    expect(mockLink.download).toBe(`report_${dateSuffix}.csv`);
  });
});
