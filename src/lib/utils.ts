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

export const generateBulkMeterKeys = (existingMeters: any[] = []) => {
  let customerKey = "";
  let instKey = "";
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    const timeHex = Date.now().toString(36).slice(-4).toUpperCase();
    const randNum = Math.floor(100000 + Math.random() * 900000);
    customerKey = `BM-${timeHex}${randNum}`;
    instKey = `INST-${timeHex}${Math.floor(1000 + Math.random() * 9000)}`;
    const keyExists = existingMeters.some(m => m.customerKeyNumber === customerKey);
    const instExists = existingMeters.some(m => m.instKey === instKey);
    if (!keyExists && !instExists) {
      isUnique = true;
    }
    attempts++;
  }
  if (!isUnique) {
    const fallbackHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    customerKey = `BM-${Date.now().toString(36).toUpperCase()}-${fallbackHex}`;
    instKey = `INST-${Date.now().toString(36).toUpperCase()}-${fallbackHex.slice(0, 4)}`;
  }
  return { customerKey, instKey };
};

export const generateCustomerKeys = (existingCustomers: any[] = []) => {
  let customerKey = "";
  let instKey = "";
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    const timeHex = Date.now().toString(36).slice(-4).toUpperCase();
    const randNum = Math.floor(100000 + Math.random() * 900000);
    customerKey = `IND-${timeHex}${randNum}`;
    instKey = `INST-${timeHex}${Math.floor(1000 + Math.random() * 9000)}`;
    const keyExists = existingCustomers.some(c => c.customerKeyNumber === customerKey);
    const instExists = existingCustomers.some(c => c.instKey === instKey);
    if (!keyExists && !instExists) {
      isUnique = true;
    }
    attempts++;
  }
  if (!isUnique) {
    const fallbackHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    customerKey = `IND-${Date.now().toString(36).toUpperCase()}-${fallbackHex}`;
    instKey = `INST-${Date.now().toString(36).toUpperCase()}-${fallbackHex.slice(0, 4)}`;
  }
  return { customerKey, instKey };
};

