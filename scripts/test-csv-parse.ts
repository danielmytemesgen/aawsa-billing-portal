import { bulkMeterDataEntrySchema, individualCustomerDataEntrySchema } from '../src/app/admin/data-entry/customer-data-entry-types';

const bulkRow = {
  name: 'Bulk A',
  customerKeyNumber: 'BM001',
  contractNumber: 'C001',
  meterSize: '2',
  meterNumber: 'MTR123',
  previousReading: '100',
  currentReading: '150',
  month: '2025-09',
  specificArea: 'Area 1',
  subCity: 'Bole',
  woreda: '1',
  branchId: 'BR01',
  chargeGroup: 'Non-domestic',
  sewerageConnection: 'No',
  xCoordinate: '10.5',
  yCoordinate: '20.5',
};

const individualRow = {
  name: 'John Doe',
  customerKeyNumber: 'CUST001',
  contractNumber: 'CN001',
  customerType: 'Domestic',
  bookNumber: 'B001',
  ordinal: '1',
  meterSize: '0.75',
  meterNumber: 'M100',
  previousReading: '50',
  currentReading: '75',
  month: '2025-09',
  specificArea: 'Area 1',
  subCity: 'Bole',
  woreda: '2',
  sewerageConnection: 'No',
  assignedBulkMeterId: 'BM001',
  branchId: 'BR01',
};

try {
  const parsedBulk = bulkMeterDataEntrySchema.parse(bulkRow);
  console.log('Bulk parsed OK:', parsedBulk);
} catch (e) {
  console.error('Bulk parse failed:', e);
}

try {
  const parsedInd = individualCustomerDataEntrySchema.parse(individualRow);
  console.log('Individual parsed OK:', parsedInd);
} catch (e) {
  console.error('Individual parse failed:', e);
}
