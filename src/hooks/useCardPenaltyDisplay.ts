import { useMemo } from 'react';
import type { DomainBill } from '@/lib/data-store';

export interface UseCardPenaltyDisplayParams {
  billCardDetails: {
    billId?: string | null;
    billKey?: string | null;
    month?: string | null;
    penaltyAmt: number;
    outstandingBill: number;
    totalDifferenceBill: number;
  };
  billingHistory: DomainBill[];
  reconstructedHistoryMap: Map<string, any>;
  isPenaltyOff: boolean;
}

export interface UseCardPenaltyDisplayResult {
  currentRenderedBillId: string | null;
  reconForCurrentCard: any | null;
  displayedPenaltyAmt: number;
  displayedTotalPayable: number;
}

/**
 * Extracts the penalty and total payable display logic for bill cards and print views.
 * Handles the fallback to reconstructed history for saved bills with PENALTYAMT=0,
 * and strictly honors the global penalty engine OFF state.
 */
export function useCardPenaltyDisplay({
  billCardDetails,
  billingHistory,
  reconstructedHistoryMap,
  isPenaltyOff,
}: UseCardPenaltyDisplayParams): UseCardPenaltyDisplayResult {
  return useMemo(() => {
    if (!billCardDetails) {
      return {
        currentRenderedBillId: null,
        reconForCurrentCard: null,
        displayedPenaltyAmt: 0,
        displayedTotalPayable: 0,
      };
    }

    const currentRenderedBillId: string | null =
      billCardDetails.billId ||
      (billCardDetails.billKey
        ? (billingHistory.find(
            b => b.BILLKEY === billCardDetails.billKey || b.id === billCardDetails.billKey
          )?.id ?? null)
        : (billingHistory.find(b => b.monthYear === billCardDetails.month)?.id ?? null)) ||
      null;

    const reconForCurrentCard = currentRenderedBillId
      ? reconstructedHistoryMap.get(currentRenderedBillId)
      : null;

    const rawPenalty = billCardDetails.penaltyAmt > 0
      ? billCardDetails.penaltyAmt
      : (reconForCurrentCard?.penalty ?? 0);

    const displayedPenaltyAmt = isPenaltyOff
      ? 0
      : Number(rawPenalty.toFixed(2));

    const outstanding = Number(billCardDetails.outstandingBill || 0);
    const differenceBill = Number(billCardDetails.totalDifferenceBill || 0);

    const displayedTotalPayable = isPenaltyOff
      ? Number((outstanding + differenceBill).toFixed(2))
      : Number((outstanding + differenceBill + displayedPenaltyAmt).toFixed(2));

    return {
      currentRenderedBillId,
      reconForCurrentCard,
      displayedPenaltyAmt,
      displayedTotalPayable,
    };
  }, [billCardDetails, billingHistory, reconstructedHistoryMap, isPenaltyOff]);
}
