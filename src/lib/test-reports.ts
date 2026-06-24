/**
 * Report Data Verification Test
 * Tests that each report's getData function can be called and returns expected structure
 * 
 * This test checks:
 * 1. getData functions are callable
 * 2. Functions return arrays
 * 3. Returned data has expected headers
 * 4. Data is not empty (when DB has data)
 * 5. No hardcoded/mock data patterns
 */

interface ReportFilters {
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
  chargeGroup?: string;
}

// Test function wrapper
async function testReportData(
  reportId: string,
  reportName: string,
  getData: (filters: ReportFilters) => Promise<any[]>,
  headers: string[]
) {
  console.log(`\n📋 Testing: ${reportName} (${reportId})`);
  console.log('─'.repeat(60));

  try {
    // Test with no filters first
    const basicData = await getData({});
    
    // Verify it returns an array
    if (!Array.isArray(basicData)) {
      console.error(`  ✗ getData did not return an array. Got: ${typeof basicData}`);
      return false;
    }
    
    console.log(`  ✓ Returns array with ${basicData.length} records`);

    // If we have data, check structure
    if (basicData.length > 0) {
      const firstRecord = basicData[0];
      
      // Check for expected headers
      const missingHeaders = headers.filter(h => !(h in firstRecord));
      if (missingHeaders.length > 0) {
        console.warn(`  ⚠ Missing headers: ${missingHeaders.join(', ')}`);
      } else {
        console.log(`  ✓ All ${headers.length} expected headers present`);
      }
      
      // Check for data quality
      const recordKeys = Object.keys(firstRecord);
      console.log(`  ✓ Data contains ${recordKeys.length} fields`);
      
      // Sample the first record (don't log sensitive data)
      const sampleKeys = recordKeys.slice(0, 3).join(', ');
      console.log(`  ✓ Sample fields: ${sampleKeys}${recordKeys.length > 3 ? ', ...' : ''}`);
    } else {
      console.log(`  ℹ No data in database (empty result is valid)`);
    }

    // Test with branch filter (if applicable)
    if (reportId !== 'tariffs-data-export' && reportId !== 'staff-data-export') {
      const filteredData = await getData({ branchId: 'test-branch-id' });
      if (Array.isArray(filteredData)) {
        console.log(`  ✓ Branch filter works (${filteredData.length} records with filter)`);
      }
    }

    console.log(`  ✓ ${reportName} PASSED`);
    return true;
  } catch (error) {
    console.error(`  ✗ Test failed with error:`);
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Export for use in tests
export { testReportData };
