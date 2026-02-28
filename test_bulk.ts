import { dbGetAllBulkMeters, dbGetBulkMeterById, dbGetAllCustomers, dbGetBillsByBulkMeterId, dbCreateBill, dbUpdateBill, dbUpdateBulkMeter } from './src/lib/db-queries';
import { calculateBill } from './src/lib/billing';
import { getBillingPeriodStartDate, getBillingPeriodEndDate, calculateDueDate } from './src/lib/billing-config';
import { calculateDebtAging } from './src/lib/billing-utils';
import { getTariff } from './src/lib/data-store';

async function testMeter(bulkMeterId: string) {
    console.log(`Testing meter ${bulkMeterId}...`);
    const monthYear = '2026-02';
    const carryBalance = true;

    const bulkMeter = await dbGetBulkMeterById(bulkMeterId);
    if (!bulkMeter) throw new Error("Bulk meter not found");

    const customers = await dbGetAllCustomers();
    const associatedCustomers = customers.filter(c => c.assigned_bulk_meter_id === bulkMeterId);

    const bmUsage = (bulkMeter.current_reading ?? 0) - (bulkMeter.previous_reading ?? 0);
    const totalIndivUsage = associatedCustomers.reduce((sum, cust) => sum + ((cust.current_reading ?? 0) - (cust.previous_reading ?? 0)), 0);

    let differenceUsageForCycle = bmUsage - totalIndivUsage;
    if (bmUsage < totalIndivUsage || differenceUsageForCycle <= 0) differenceUsageForCycle = 3;
    else if (differenceUsageForCycle === 1) differenceUsageForCycle = 3;
    else if (differenceUsageForCycle === 2) differenceUsageForCycle = 3;

    const chargeGroup = (bulkMeter.charge_group || 'Non-domestic') as any;
    const sewerageConn = (bulkMeter.sewerage_connection || 'No') as any;

    console.log('Calculating bill...');
    const billBreakdown = await calculateBill(
        differenceUsageForCycle,
        chargeGroup,
        sewerageConn,
        bulkMeter.meter_size ?? 0.5,
        monthYear
    );
    console.log('Bill calculated:', billBreakdown);

    const balanceFromPreviousPeriods = bulkMeter.outStandingbill || 0;
    const historicalBills = await dbGetBillsByBulkMeterId(bulkMeterId);

    const { dbGetLatestApplicableTariff } = await import('./src/lib/db-queries');
    const activeTariffRow = await dbGetLatestApplicableTariff(chargeGroup, `${monthYear}-28`);
    let activeTariff;
    if (activeTariffRow) {
        activeTariff = {
            ...activeTariffRow,
            tiers: typeof activeTariffRow.tiers === 'string' ? JSON.parse(activeTariffRow.tiers) : activeTariffRow.tiers,
            sewerage_tiers: typeof activeTariffRow.sewerage_tiers === 'string' ? JSON.parse(activeTariffRow.sewerage_tiers) : activeTariffRow.sewerage_tiers,
            meter_rent_prices: typeof activeTariffRow.meter_rent_prices === 'string' ? JSON.parse(activeTariffRow.meter_rent_prices) : activeTariffRow.meter_rent_prices,
            additional_fees: typeof activeTariffRow.additional_fees === 'string' ? JSON.parse(activeTariffRow.additional_fees) : activeTariffRow.additional_fees,
            penalty_tiered_rates: typeof activeTariffRow.penalty_tiered_rates === 'string' && activeTariffRow.penalty_tiered_rates ? JSON.parse(activeTariffRow.penalty_tiered_rates) : activeTariffRow.penalty_tiered_rates,
            penalty_month_threshold: activeTariffRow.penalty_month_threshold !== null && activeTariffRow.penalty_month_threshold !== undefined ? Number(activeTariffRow.penalty_month_threshold) : undefined,
            bank_lending_rate: activeTariffRow.bank_lending_rate !== null && activeTariffRow.bank_lending_rate !== undefined ? Number(activeTariffRow.bank_lending_rate) : undefined,
        };
    }
    console.log('Active Tariff Penalty config:', {
        tiers: activeTariff?.penalty_tiered_rates,
        threshold: activeTariff?.penalty_month_threshold,
        rate: activeTariff?.bank_lending_rate
    });

    const { debit30, debit30_60, debit60, penaltyAmt } = calculateDebtAging(balanceFromPreviousPeriods, historicalBills, activeTariff);
    console.log('Debits:', { debit30, debit30_60, debit60, penaltyAmt });

    const totalPayableForCycle = billBreakdown.totalBill + balanceFromPreviousPeriods + penaltyAmt;
    console.log('Total payable:', totalPayableForCycle);

    // We stop here before DB inserts to not mutate data if we find the error.
    console.log('Success passing calculation stage for', bulkMeterId);
}

async function main() {
    try {
        const meters = await dbGetAllBulkMeters();
        console.log(`Found ${meters.length} bulk meters.`);
        for (const m of meters) {
            await testMeter(m.customerKeyNumber);
        }
    } catch (err) {
        console.error('Fatal Error:', err);
    }
}

main();
