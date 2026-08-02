import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const generateBulkMeterKeys = (existingMeters: any[]) => {
  let customerKey = "";
  let instKey = "";
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    customerKey = `BM-${Math.floor(10000000 + Math.random() * 90000000)}`;
    instKey = `INST-${Math.floor(100000 + Math.random() * 900000)}`;
    const keyExists = existingMeters.some(m => m.customerKeyNumber === customerKey);
    const instExists = existingMeters.some(m => m.instKey === instKey);
    if (!keyExists && !instExists) {
      isUnique = true;
    }
    attempts++;
  }
  return { customerKey, instKey };
};

export const generateCustomerKeys = (existingCustomers: any[]) => {
  let customerKey = "";
  let instKey = "";
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    customerKey = `IND-${Math.floor(10000000 + Math.random() * 90000000)}`;
    instKey = `INST-${Math.floor(100000 + Math.random() * 900000)}`;
    const keyExists = existingCustomers.some(c => c.customerKeyNumber === customerKey);
    const instExists = existingCustomers.some(c => c.instKey === instKey);
    if (!keyExists && !instExists) {
      isUnique = true;
    }
    attempts++;
  }
  return { customerKey, instKey };
};
