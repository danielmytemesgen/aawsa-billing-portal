
import { initializeCustomers, addBulkMeter, getBulkMeterByCustomerKey, initializeBulkMeters, initializeTariffs, addCustomer, deleteCustomer, deleteBulkMeter } from '../src/lib/data-store';
import type { StaffMember } from '@/app/admin/staff-management/staff-types';
import { customerTypes } from '@/lib/billing';

async function runBulkBillingTest() {
  console.log('--- Running Bulk Billing Test ---');

  // Mock current user
  const currentUser: StaffMember = {
    id: 'test-user',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
  };

  // Initialize tariffs
  await initializeTariffs();

  // Mock customers
  const mockCustomers = [
    {
      customerKeyNumber: 'CUST-001',
      name: 'Test Customer 1',
      contractNumber: 'CT-001',
      customerType: customerTypes[0],
      bookNumber: 'B-001',
      ordinal: 1,
      meterSize: 0.75,
      meterNumber: 'M-001',
      previousReading: 100,
      currentReading: 110, // Usage = 10
      month: '2025-11',
      specificArea: 'Area 1',
      subCity: 'Sub City 1',
      woreda: 'Woreda 1',
      sewerageConnection: 'Yes' as const,
      assignedBulkMeterId: 'BM-001',
      branchId: '1',
      status: 'Active' as const,
      paymentStatus: 'Unpaid' as const,
    },
    {
      customerKeyNumber: 'CUST-002',
      name: 'Test Customer 2',
      contractNumber: 'CT-002',
      customerType: customerTypes[0],
      bookNumber: 'B-001',
      ordinal: 2,
      meterSize: 0.75,
      meterNumber: 'M-002',
      previousReading: 200,
      currentReading: 215, // Usage = 15
      month: '2025-11',
      specificArea: 'Area 1',
      subCity: 'Sub City 1',
      woreda: 'Woreda 1',
      sewerageConnection: 'Yes' as const,
      assignedBulkMeterId: 'BM-001',
      branchId: '1',
      status: 'Active' as const,
      paymentStatus: 'Unpaid' as const,
    },
  ];

  // Mock bulk meter
  const mockBulkMeter = {
    customerKeyNumber: 'BM-001',
    name: 'Test Bulk Meter',
    contractNumber: 'CT-BM-001',
    meterSize: 2,
    meterNumber: 'BM-M-001',
    previousReading: 1000,
    currentReading: 1020, // Bulk Usage = 20
    month: '2025-11',
    specificArea: 'Area 1',
    subCity: 'Sub City 1',
    woreda: 'Woreda 1',
    branchId: '1',
    status: 'Active' as const,
    paymentStatus: 'Unpaid' as const,
    chargeGroup: 'Non-domestic' as const,
    sewerageConnection: 'Yes' as const,
  };

  // Total individual usage = 10 + 15 = 25
  // Bulk usage = 20
  // Bulk Usage < Total Individual Usage, so difference usage should be 3

  try {
    // Add mock customers
    for (const customer of mockCustomers) {
      await addCustomer(customer, currentUser);
    }
    console.log('Mock customers added successfully.');

    // Add the bulk meter
    const result = await addBulkMeter(mockBulkMeter, currentUser);

    if (!result.success) {
      throw new Error(`Failed to add bulk meter: ${result.message}`);
    }

    console.log('Bulk meter added successfully.');

    // Fetch the bulk meter to verify the calculated fields
    await initializeBulkMeters();
    const { data: addedBulkMeter } = await getBulkMeterByCustomerKey('BM-001');

    if (!addedBulkMeter) {
      throw new Error('Failed to fetch the newly added bulk meter.');
    }

    console.log('Fetched bulk meter:', addedBulkMeter);

    // Assertions
    if (addedBulkMeter.differenceUsage === 3) {
      console.log('✅ Test Passed: differenceUsage is 3');
    } else {
      console.error(`❌ Test Failed: differenceUsage is ${addedBulkMeter.differenceUsage}, expected 3`);
    }

    if (addedBulkMeter.differenceBill && addedBulkMeter.differenceBill > 0) {
      console.log('✅ Test Passed: differenceBill is calculated');
    } else {
      console.error(`❌ Test Failed: differenceBill is ${addedBulkMeter.differenceBill}, expected a positive number`);
    }

  } catch (error) {
    console.error('Bulk billing test failed:', error);
  } finally {
    // Clean up mock data
    for (const customer of mockCustomers) {
      await deleteCustomer(customer.customerKeyNumber);
    }
    await deleteBulkMeter(mockBulkMeter.customerKeyNumber);
    console.log('Mock data cleaned up.');
    process.exit(0);
  }
}

runBulkBillingTest().catch(err => {
  console.error(err);
  process.exit(1);
});
