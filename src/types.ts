/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProductionData } from './services/dataService';

export interface DashboardState {
  allData: ProductionData[];
  filteredData: ProductionData[];
  parameters: string[];
  selectedParameter: string | null;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  isLoading: boolean;
  error: string | null;
}
