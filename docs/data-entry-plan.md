# Renaming numberOfDials to NUMBER_OF_DIALS

The user has explicitly requested that the "NUMBER_OF_DIALS" field be in all capital letters, likely to match the database column naming convention and other keys like `CUST_KEY`.

## User Review Required

> [!NOTE]
> This change renames the property `numberOfDials` to `NUMBER_OF_DIALS` in the TypeScript code, Zod schemas, and Form handling. This ensures consistency with the database column name.

## Proposed Changes

### Data Entry Types
#### [MODIFY] [customer-data-entry-types.ts](file:///d:/tiktok%20video/New%20folder/aawsa-billing-portal%20%282%29/aawsa-billing-portal%20-%20Copy/src/app/admin/data-entry/customer-data-entry-types.ts)
- Rename `numberOfDials` to `NUMBER_OF_DIALS` in `baseIndividualCustomerDataSchema` and `baseBulkMeterDataSchema`.

### Data Store
#### [MODIFY] [data-store.ts](file:///d:/tiktok%20video/New%20folder/aawsa-billing-portal%20%282%29/aawsa-billing-portal%20-%20Copy/src/lib/data-store.ts)
- Rename `numberOfDials` to `NUMBER_OF_DIALS` in `DomainIndividualCustomer` and `DomainBulkMeter` interfaces.
- Update mappers `mapDomainCustomerToInsert`, `mapDbCustomerToDomain`, `mapDomainBulkMeterToInsert`, `mapDbBulkMeterToDomain` to use `NUMBER_OF_DIALS`.

### Forms
#### [MODIFY] [individual-customer-data-entry-form.tsx](file:///d:/tiktok%20video/New%20folder/aawsa-billing-portal%20%282%29/aawsa-billing-portal%20-%20Copy/src/app/admin/data-entry/individual-customer-data-entry-form.tsx)
- Update `name="numberOfDials"` to `name="NUMBER_OF_DIALS"`.

#### [MODIFY] [bulk-meter-data-entry-form.tsx](file:///d:/tiktok%20video/New%20folder/aawsa-billing-portal%20%282%29/aawsa-billing-portal%20-%20Copy/src/app/admin/data-entry/bulk-meter-data-entry-form.tsx)
- Update `name="numberOfDials"` to `name="NUMBER_OF_DIALS"`.

### CSV Upload
#### [MODIFY] [csv-reading-upload-dialog.tsx](file:///d:/tiktok%20video/New%20folder/aawsa-billing-portal%20%282%29/aawsa-billing-portal%20-%20Copy/src/components/csv-reading-upload-dialog.tsx)
- Update usage of `validatedRow.numberOfDials` (if any, or check mapping) to Ensure `validatedRow.NUMBER_OF_DIALS` is used and passed correctly. Note: The CSV header is already likely `NUMBER_OF_DIALS` if it follows the schema, so this might just be ensuring the internal object key matches.

## Verification Plan

### Manual Verification
1.  **Forms**: Open "Admin Data Entry" -> "Individual Customer" and "Bulk Meter". Verify the "Number of Dials" field is present and works. Inspect the submission payload in network/console to see `NUMBER_OF_DIALS` key.
2.  **CSV Upload**: Check the template download. It should have `NUMBER_OF_DIALS` column.
