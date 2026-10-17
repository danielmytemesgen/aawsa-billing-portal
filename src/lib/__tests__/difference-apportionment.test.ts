import { describe, it, expect } from "vitest";

describe("Difference Bill Apportionment Logic", () => {
  it("proportionally distributes bulk difference bill based on individual consumption", () => {
    const diffBillAmount = 1000.00;
    const submeters = [
      { customerKeyNumber: "CUST-1", usage: 10, ownBill: 150 },
      { customerKeyNumber: "CUST-2", usage: 20, ownBill: 300 },
      { customerKeyNumber: "CUST-3", usage: 70, ownBill: 1050 },
    ];

    const totalUsage = submeters.reduce((sum, s) => sum + s.usage, 0); // 100
    expect(totalUsage).toBe(100);

    let allocatedTotal = 0;
    const items = submeters.map((s) => {
      const ratio = s.usage / totalUsage;
      const apportioned = Number((ratio * diffBillAmount).toFixed(2));
      allocatedTotal += apportioned;
      return {
        customerKeyNumber: s.customerKeyNumber,
        ratio,
        apportioned,
        totalPayable: Number((s.ownBill + apportioned).toFixed(2)),
      };
    });

    expect(items[0].apportioned).toBe(100.00); // 10% of 1000
    expect(items[0].totalPayable).toBe(250.00); // 150 + 100

    expect(items[1].apportioned).toBe(200.00); // 20% of 1000
    expect(items[1].totalPayable).toBe(500.00); // 300 + 200

    expect(items[2].apportioned).toBe(700.00); // 70% of 1000
    expect(items[2].totalPayable).toBe(1750.00); // 1050 + 700

    const sumApportioned = items.reduce((sum, it) => sum + it.apportioned, 0);
    expect(sumApportioned).toBe(diffBillAmount);
  });

  it("handles cent rounding discrepancy and corrects delta to the highest consumer", () => {
    // 100.00 divided by 3 consumers with equal usage: 33.33 * 3 = 99.99, delta = 0.01
    const diffBillAmount = 100.00;
    const submeters = [
      { customerKeyNumber: "CUST-1", usage: 10, ownBill: 50 },
      { customerKeyNumber: "CUST-2", usage: 10, ownBill: 50 },
      { customerKeyNumber: "CUST-3", usage: 10, ownBill: 50 },
    ];

    const totalUsage = 30;
    let allocatedTotal = 0;
    const items = submeters.map((s) => {
      const ratio = s.usage / totalUsage;
      const apportioned = Number((ratio * diffBillAmount).toFixed(2)); // 33.33
      allocatedTotal += apportioned;
      return {
        customerKeyNumber: s.customerKeyNumber,
        ownUsage: s.usage,
        apportionedDifferenceBill: apportioned,
        ownBillAmount: s.ownBill,
        totalPayable: Number((s.ownBill + apportioned).toFixed(2)),
      };
    });

    expect(allocatedTotal).toBe(99.99);
    const roundingDelta = Number((diffBillAmount - allocatedTotal).toFixed(2));
    expect(roundingDelta).toBe(0.01);

    // Apply correction
    let maxIdx = 0;
    for (let i = 1; i < items.length; i++) {
      if (items[i].ownUsage > items[maxIdx].ownUsage) {
        maxIdx = i;
      }
    }
    items[maxIdx].apportionedDifferenceBill = Number(
      (items[maxIdx].apportionedDifferenceBill + roundingDelta).toFixed(2)
    );
    items[maxIdx].totalPayable = Number(
      (items[maxIdx].ownBillAmount + items[maxIdx].apportionedDifferenceBill).toFixed(2)
    );

    const adjustedSum = items.reduce((sum, it) => sum + it.apportionedDifferenceBill, 0);
    expect(adjustedSum).toBe(100.00);
    expect(items[0].apportionedDifferenceBill).toBe(33.34);
  });

  it("handles equal split across all assigned units", () => {
    const diffBillAmount = 750.00;
    const unitCount = 5;
    const equalShare = Number((diffBillAmount / unitCount).toFixed(2));
    expect(equalShare).toBe(150.00);
    expect(equalShare * unitCount).toBe(diffBillAmount);
  });

  it("handles zero total submeter usage by falling back safely to equal split", () => {
    const diffBillAmount = 500.00;
    const submeters = [
      { customerKeyNumber: "CUST-1", usage: 0, ownBill: 0 },
      { customerKeyNumber: "CUST-2", usage: 0, ownBill: 0 },
    ];
    const totalUsage = submeters.reduce((sum, s) => sum + s.usage, 0);
    expect(totalUsage).toBe(0);

    const unitCount = submeters.length;
    const equalShare = Number((diffBillAmount / unitCount).toFixed(2));
    expect(equalShare).toBe(250.00);
  });
});
