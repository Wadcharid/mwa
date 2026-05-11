import { parse } from 'papaparse';

export interface ProductionData {
  date: Date;
  [key: string]: string | number | Date;
}

export interface SheetMetadata {
  id: string;
  gid: string;
  name?: string;
}

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1wR9XOXr3EiwhjCJpWPc-QqwZD2Ikq_aBqYxyUUfX77Q/export?format=csv&gid=0';

export async function fetchSheetData(url: string = DEFAULT_SHEET_URL): Promise<{ data: ProductionData[]; columns: string[] }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }
    const csvString = await response.text();

    return new Promise((resolve, reject) => {
      parse(csvString, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rawData = results.data as any[];
          const columns = results.meta.fields || [];
          
          if (rawData.length === 0) {
            resolve({ data: [], columns });
            return;
          }

          // Identity column A as Date (as specified by user)
          const dateColumn = columns[0];
          
          const formattedData = rawData.map((row) => {
            const dateValue = row[dateColumn];
            let parsedDate = new Date(dateValue);
            
            // Handle invalid dates if necessary
            if (isNaN(parsedDate.getTime())) {
              // Try parsing fallback or just use current date to avoid crash (though not ideal)
              parsedDate = new Date();
            }

            return {
              ...row,
              date: parsedDate,
            };
          }).sort((a, b) => a.date.getTime() - b.date.getTime());

          resolve({ data: formattedData, columns: columns.slice(1) }); // Return non-date columns for param selection
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  } catch (err) {
    console.error('Error fetching sheet data:', err);
    throw err;
  }
}

export function exportToCSV(data: any[], filename: string = 'production_data.csv') {
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        if (val instanceof Date) return val.toISOString().split('T')[0];
        return JSON.stringify(val);
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
