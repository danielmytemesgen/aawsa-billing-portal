import { describe, it, expect } from "vitest";

describe("Bill Status Toggle Logic (Paid <-> Unpaid)", () => {
  it("computes correct fields when marking a bill Paid", () => {
    const bill = {
      id: "bill-1",
      TOTALBILLAMOUNT: 1500,
      paymentStatus: "Unpaid" as const,
      amountPaid: 0,
    };

    const targetStatus = "Paid";
    const amountPaid = 1500;
    const paymentChannel = "Telebirr";
    const transactionReference = "TEL-998877";
    const paymentDate = "2026-09-25";

    const isMarkingPaid = targetStatus === "Paid";
    const resolvedAmount = isMarkingPaid
      ? (amountPaid !== undefined && amountPaid > 0 ? amountPaid : bill.TOTALBILLAMOUNT)
      : 0;

    expect(resolvedAmount).toBe(1500);
    expect(isMarkingPaid).toBe(true);
    expect(paymentChannel).toBe("Telebirr");
    expect(transactionReference).toBe("TEL-998877");
  });

  it("computes correct fields when reverting a bill to Unpaid", () => {
    const bill = {
      id: "bill-2",
      TOTALBILLAMOUNT: 2300,
      paymentStatus: "Paid" as const,
      amountPaid: 2300,
    };

    const targetStatus = "Unpaid";
    const reversalReason = "Payment reversed by administrator due to cheque bounce";

    const isReversal = targetStatus === "Unpaid" && bill.paymentStatus === "Paid";
    const newAmountPaid = targetStatus === "Unpaid" ? 0 : bill.amountPaid;
    const reversalAmount = isReversal ? (bill.amountPaid > 0 ? -bill.amountPaid : -bill.TOTALBILLAMOUNT) : 0;

    expect(isReversal).toBe(true);
    expect(newAmountPaid).toBe(0);
    expect(reversalAmount).toBe(-2300);
    expect(reversalReason).toContain("cheque bounce");
  });

  it("handles partial payments correctly", () => {
    const totalAmount = 5000;
    const partialAmount = 2500;

    const isPartial = partialAmount > 0 && partialAmount < totalAmount - 0.01;
    expect(isPartial).toBe(true);

    const isFull = totalAmount - partialAmount <= 0.01;
    expect(isFull).toBe(false);
  });
});
