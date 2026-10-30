"use client";

import React from "react";
import { BillsBranchSummaryCard, type BillsBranchSummaryCardProps } from "./BillsBranchSummaryCard";
import type { SentBillsBranchSummaryRow } from "@/lib/db-queries";

export interface SentBillsBranchSummaryCardProps extends Omit<BillsBranchSummaryCardProps, "type"> {
  summary: SentBillsBranchSummaryRow[];
}

export function SentBillsBranchSummaryCard(props: SentBillsBranchSummaryCardProps) {
  return <BillsBranchSummaryCard type="sent" {...props} />;
}
