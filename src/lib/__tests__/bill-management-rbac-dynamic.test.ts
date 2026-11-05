import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../constants/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Simulated permission checker matching usePermissions() and checkPermissionAny()
// ─────────────────────────────────────────────────────────────────────────────
function makeHasPermission(perms: string[]) {
  const set = new Set(perms);
  return (p: string) => {
    if (set.has('*') || set.has('all') || set.has('admin')) return true;
    if (set.has('bill:manage_all') && (p.startsWith('bill:') || p === 'billing:close_cycle')) return true;
    return set.has(p);
  };
}

// Simulated BillManagementContent & BillDetailsContent computed flags
function computeBillManagementFlags(hasPermission: (p: string) => boolean) {
  const canViewDrafts = hasPermission('bill:view_drafts') || hasPermission('bill:manage_all');
  const canViewPending = hasPermission('bill:view_pending') || hasPermission('bill:approve') || hasPermission('bill:manage_all');
  const canViewRework = hasPermission('bill:rework') || hasPermission('bill:manage_all');
  const canViewApproved = hasPermission('bill:view_approved') || hasPermission('bill:send') || hasPermission('bill:post') || hasPermission('bill:approve') || hasPermission('bill:manage_all');
  const canViewPaid = hasPermission('bill:view_paid') || hasPermission('bill:manage_all');
  const canViewUnpaid = hasPermission('bill:view_awaiting_payment') || hasPermission('bill:view_overdue') || hasPermission('bill:manage_all');

  const canManagePayment = hasPermission(PERMISSIONS.BILL_UPDATE)
      || hasPermission(PERMISSIONS.BILL_VIEW_ALL)
      || hasPermission(PERMISSIONS.BILL_POST);

  const canSubmitBills = hasPermission('bill:submit') || hasPermission('bill:create') || hasPermission('bill:manage_all');
  const canApproveBills = hasPermission('bill:approve') || hasPermission('bill:manage_all');
  const canPostBills = hasPermission('bill:post') || hasPermission('bill:send') || hasPermission('bill:manage_all');

  const canSeeOutstandingTable = canViewUnpaid || canManagePayment || hasPermission('bill:view_branch') || hasPermission('bill:manage_all');
  const canSeePaidBillsTable = canViewPaid || canManagePayment || hasPermission('bill:view_branch') || hasPermission('bill:manage_all');

  const canAccessPage = canViewDrafts || canViewPending || canViewRework || canViewApproved || canViewPaid || canViewUnpaid || hasPermission('bill:view_branch') || hasPermission('bill:manage_all');

  const canExportCSV = hasPermission('bill:view_branch') || hasPermission('bill:manage_all') || canSeeOutstandingTable || canSeePaidBillsTable;
  const canAudit = hasPermission('bill:manage_all') || hasPermission('bill:approve');
  const canResetDeleteBatch = hasPermission('bill:manage_all') || hasPermission('bill:delete');
  const canCloseCycle = hasPermission('billing:close_cycle') || hasPermission('bill:manage_all');

  return {
    canViewDrafts,
    canViewPending,
    canViewRework,
    canViewApproved,
    canViewPaid,
    canViewUnpaid,
    canManagePayment,
    canSubmitBills,
    canApproveBills,
    canPostBills,
    canSeeOutstandingTable,
    canSeePaidBillsTable,
    canAccessPage,
    canExportCSV,
    canAudit,
    canResetDeleteBatch,
    canCloseCycle,
  };
}

function computeBillDetailsFlags(status: string, hasPermission: (p: string) => boolean) {
  const checkBillPermission = (...permissions: string[]) => {
    if (hasPermission('bill:manage_all')) return true;
    return permissions.some(p => hasPermission(p));
  };

  const canEdit = (status === 'Draft' || status === 'Rework') &&
    (checkBillPermission(PERMISSIONS.BILL_UPDATE) ||
     hasPermission(PERMISSIONS.BULK_METERS_EDIT_READINGS_VIEW) ||
     hasPermission(PERMISSIONS.BULK_METERS_EDIT_READINGS) ||
     hasPermission(PERMISSIONS.METER_READINGS_EDIT_RECALCULATE_VIEW) ||
     hasPermission(PERMISSIONS.METER_READINGS_EDIT_RECALCULATE));

  const canSubmit = (status === 'Draft' || status === 'Rework') && checkBillPermission('bill:submit', 'bill:create');
  const canApprove = status === 'Pending' && checkBillPermission('bill:approve');
  const canRework = status === 'Pending' && checkBillPermission('bill:rework');
  const canPost = status === 'Approved' && checkBillPermission('bill:send', 'bill:post');
  const canCorrect = status === 'Posted' && checkBillPermission('bill:correct');
  const canEditPayment = checkBillPermission(PERMISSIONS.BILL_UPDATE, PERMISSIONS.BILL_POST, PERMISSIONS.PAYMENTS_CREATE, PERMISSIONS.BILL_VIEW_ALL);

  return {
    canEdit,
    canSubmit,
    canApprove,
    canRework,
    canPost,
    canCorrect,
    canEditPayment,
  };
}


function computeRowActionFlags(hasPermission: (p: string) => boolean, bill: { status?: string; bill_number?: string; notes?: string; payment_status?: string } = {}) {
  const canViewDetails = hasPermission(PERMISSIONS.BILL_VIEW_ALL)
      || hasPermission(PERMISSIONS.BILL_VIEW_BRANCH)
      || hasPermission(PERMISSIONS.BILL_VIEW_PAID)
      || hasPermission(PERMISSIONS.BILL_VIEW_UNPAID)
      || hasPermission(PERMISSIONS.BILL_VIEW_OVERDUE)
      || hasPermission(PERMISSIONS.BILL_VIEW_DRAFTS)
      || hasPermission(PERMISSIONS.BILL_VIEW_PENDING)
      || hasPermission(PERMISSIONS.BILL_VIEW_APPROVED);

  const canCheckCorrection = hasPermission(PERMISSIONS.BILL_CORRECT)
      || hasPermission(PERMISSIONS.BILL_CORRECT_VIEW)
      || hasPermission(PERMISSIONS.REPORT_LIST_OF_CORRECTED_BILLS)
      || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_CORRECTED_BILLS)
      || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  const canPrintExportBill = hasPermission(PERMISSIONS.REPORT_MONTHLY_BILL_EXPORT)
      || hasPermission(PERMISSIONS.REPORT_BRANCH_MONTHLY_BILL_EXPORT)
      || hasPermission(PERMISSIONS.BILL_POST)
      || hasPermission(PERMISSIONS.BILL_SEND)
      || hasPermission(PERMISSIONS.BILL_VIEW_BRANCH)
      || hasPermission(PERMISSIONS.BILL_VIEW_PAID)
      || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  const canEditPayment = hasPermission(PERMISSIONS.BILL_UPDATE)
      || hasPermission(PERMISSIONS.BILL_POST)
      || hasPermission(PERMISSIONS.PAYMENTS_CREATE)
      || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  const canDisputeRecord = hasPermission(PERMISSIONS.BILL_UPDATE)
      || hasPermission(PERMISSIONS.BILL_REWORK)
      || hasPermission(PERMISSIONS.BILL_CORRECT)
      || hasPermission(PERMISSIONS.SUPPORT_CREATE)
      || hasPermission(PERMISSIONS.SUPPORT_MANAGE)
      || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  const canDeleteRecord = hasPermission(PERMISSIONS.BILL_DELETE) || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  const isCorrection = Boolean(bill.bill_number?.startsWith('CORR-') || (typeof bill.notes === 'string' && bill.notes.includes('Correction of')) || bill.status === 'Reversed');

  return {
    showViewDetails: canViewDetails,
    showCheckCorrection: canCheckCorrection && isCorrection,
    showPrintExport: canPrintExportBill,
    showEditPayment: canEditPayment,
    showDispute: canDisputeRecord && bill.status !== 'Disputed',
    showDelete: canDeleteRecord,
    hasAnyRowAction: canViewDetails || (canCheckCorrection && isCorrection) || canPrintExportBill || canEditPayment || (canDisputeRecord && bill.status !== 'Disputed') || canDeleteRecord,
  };
}

describe('All 18 Bill Management Permissions & Dynamic UI Flipping', () => {

  describe('1. bill:view_drafts', () => {
    it('grants view to drafts in TaskBoard but denies approve, post, and paid table', () => {
      const hasPerm = makeHasPermission(['bill:view_drafts']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canViewDrafts).toBe(true);
      expect(flags.canViewPending).toBe(false);
      expect(flags.canViewApproved).toBe(false);
      expect(flags.canSeePaidBillsTable).toBe(false);
      expect(flags.canAccessPage).toBe(true);
    });
  });

  describe('2. bill:view_branch', () => {
    it('grants access to branch bills, enabling page access and tables', () => {
      const hasPerm = makeHasPermission(['bill:view_branch']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canAccessPage).toBe(true);
      expect(flags.canSeeOutstandingTable).toBe(true);
      expect(flags.canSeePaidBillsTable).toBe(true);
      expect(flags.canExportCSV).toBe(true);
      expect(flags.canViewDrafts).toBe(false);
    });
  });

  describe('3. bill:view_pending', () => {
    it('unlocks pending approvals column in TaskBoard', () => {
      const hasPerm = makeHasPermission(['bill:view_pending']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canViewPending).toBe(true);
      expect(flags.canViewDrafts).toBe(false);
      expect(flags.canApproveBills).toBe(false); // Can view pending, but cannot approve without bill:approve
    });
  });

  describe('4. bill:view_approved', () => {
    it('unlocks ready to post column in TaskBoard', () => {
      const hasPerm = makeHasPermission(['bill:view_approved']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canViewApproved).toBe(true);
      expect(flags.canPostBills).toBe(false); // Can view, but cannot post without bill:post
    });
  });

  describe('5. bill:view_paid', () => {
    it('specifically reveals the Paid Bills Table and hides outstanding if not permitted', () => {
      const hasPerm = makeHasPermission(['bill:view_paid']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canSeePaidBillsTable).toBe(true);
      expect(flags.canSeeOutstandingTable).toBe(false);
      expect(flags.canViewDrafts).toBe(false);
    });
  });

  describe('6. bill:view_awaiting_payment', () => {
    it('reveals Outstanding Bills Table for awaiting payment', () => {
      const hasPerm = makeHasPermission(['bill:view_awaiting_payment']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canSeeOutstandingTable).toBe(true);
      expect(flags.canSeePaidBillsTable).toBe(false);
    });
  });

  describe('7. bill:view_overdue', () => {
    it('reveals Outstanding Bills Table for overdue bills', () => {
      const hasPerm = makeHasPermission(['bill:view_overdue']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canSeeOutstandingTable).toBe(true);
      expect(flags.canSeePaidBillsTable).toBe(false);
    });
  });

  describe('8. bill:manage_all', () => {
    it('unlocks every single UI component and action', () => {
      const hasPerm = makeHasPermission(['bill:manage_all']);
      const mgmt = computeBillManagementFlags(hasPerm);
      expect(mgmt.canAccessPage).toBe(true);
      expect(mgmt.canViewDrafts).toBe(true);
      expect(mgmt.canViewPending).toBe(true);
      expect(mgmt.canViewApproved).toBe(true);
      expect(mgmt.canViewPaid).toBe(true);
      expect(mgmt.canViewUnpaid).toBe(true);
      expect(mgmt.canSubmitBills).toBe(true);
      expect(mgmt.canApproveBills).toBe(true);
      expect(mgmt.canPostBills).toBe(true);
      expect(mgmt.canSeeOutstandingTable).toBe(true);
      expect(mgmt.canSeePaidBillsTable).toBe(true);
      expect(mgmt.canExportCSV).toBe(true);
      expect(mgmt.canAudit).toBe(true);
      expect(mgmt.canResetDeleteBatch).toBe(true);
      expect(mgmt.canCloseCycle).toBe(true);

      const draftDetail = computeBillDetailsFlags('Draft', hasPerm);
      expect(draftDetail.canEdit).toBe(true);
      expect(draftDetail.canSubmit).toBe(true);

      const pendingDetail = computeBillDetailsFlags('Pending', hasPerm);
      expect(pendingDetail.canApprove).toBe(true);
      expect(pendingDetail.canRework).toBe(true);

      const approvedDetail = computeBillDetailsFlags('Approved', hasPerm);
      expect(approvedDetail.canPost).toBe(true);

      const postedDetail = computeBillDetailsFlags('Posted', hasPerm);
      expect(postedDetail.canCorrect).toBe(true);
      expect(postedDetail.canEditPayment).toBe(true);
    });
  });

  describe('9. bill:create', () => {
    it('allows submitting draft bills for approval', () => {
      const hasPerm = makeHasPermission(['bill:create']);
      const draftDetail = computeBillDetailsFlags('Draft', hasPerm);
      expect(draftDetail.canSubmit).toBe(true);
    });
  });

  describe('10. bill:update', () => {
    it('allows editing draft readings and editing payment info', () => {
      const hasPerm = makeHasPermission(['bill:update']);
      const draftDetail = computeBillDetailsFlags('Draft', hasPerm);
      expect(draftDetail.canEdit).toBe(true);
      expect(draftDetail.canEditPayment).toBe(true);

      const postedDetail = computeBillDetailsFlags('Posted', hasPerm);
      expect(postedDetail.canEditPayment).toBe(true);
    });
  });

  describe('11. bill:delete', () => {
    it('reveals Reset / Delete Batch button in header and allows deletion in tables', () => {
      const hasPerm = makeHasPermission(['bill:delete']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canResetDeleteBatch).toBe(true);
      expect(flags.canAudit).toBe(false);
      expect(flags.canCloseCycle).toBe(false);
    });
  });

  describe('12. bill:submit', () => {
    it('allows submitting bills for manager approval in Action Center', () => {
      const hasPerm = makeHasPermission(['bill:submit']);
      const draftDetail = computeBillDetailsFlags('Draft', hasPerm);
      expect(draftDetail.canSubmit).toBe(true);
      expect(draftDetail.canApprove).toBe(false);

      const mgmt = computeBillManagementFlags(hasPerm);
      expect(mgmt.canSubmitBills).toBe(true);
    });
  });

  describe('13. bill:approve', () => {
    it('reveals Approve Invoice button, Audit & Inspection, and auto-enables viewing pending', () => {
      const hasPerm = makeHasPermission(['bill:approve']);
      const pendingDetail = computeBillDetailsFlags('Pending', hasPerm);
      expect(pendingDetail.canApprove).toBe(true);

      const mgmt = computeBillManagementFlags(hasPerm);
      expect(mgmt.canViewPending).toBe(true);
      expect(mgmt.canApproveBills).toBe(true);
      expect(mgmt.canAudit).toBe(true);
    });
  });

  describe('14. bill:rework', () => {
    it('reveals Reject & Request Rework button in Pending state and views rework items', () => {
      const hasPerm = makeHasPermission(['bill:rework']);
      const pendingDetail = computeBillDetailsFlags('Pending', hasPerm);
      expect(pendingDetail.canRework).toBe(true);
      expect(pendingDetail.canApprove).toBe(false);

      const mgmt = computeBillManagementFlags(hasPerm);
      expect(mgmt.canViewRework).toBe(true);
    });
  });

  describe('15. bill:post', () => {
    it('reveals Post & Finalize Bill button in Action Center', () => {
      const hasPerm = makeHasPermission(['bill:post']);
      const approvedDetail = computeBillDetailsFlags('Approved', hasPerm);
      expect(approvedDetail.canPost).toBe(true);

      const mgmt = computeBillManagementFlags(hasPerm);
      expect(mgmt.canPostBills).toBe(true);
    });
  });

  describe('16. bill:send', () => {
    it('acts as alias to post and finalize bills', () => {
      const hasPerm = makeHasPermission(['bill:send']);
      const approvedDetail = computeBillDetailsFlags('Approved', hasPerm);
      expect(approvedDetail.canPost).toBe(true);

      const mgmt = computeBillManagementFlags(hasPerm);
      expect(mgmt.canPostBills).toBe(true);
      expect(mgmt.canViewApproved).toBe(true);
    });
  });

  describe('17. bill:correct', () => {
    it('reveals Correct Bill button when a bill is posted', () => {
      const hasPerm = makeHasPermission(['bill:correct']);
      const postedDetail = computeBillDetailsFlags('Posted', hasPerm);
      expect(postedDetail.canCorrect).toBe(true);

      // Without bill:correct, the button is hidden
      const noPerm = makeHasPermission(['bill:view_paid']);
      const noCorr = computeBillDetailsFlags('Posted', noPerm);
      expect(noCorr.canCorrect).toBe(false);
    });
  });

  describe('18. billing:close_cycle', () => {
    it('reveals Start New Billing Cycle button in management header', () => {
      const hasPerm = makeHasPermission(['billing:close_cycle']);
      const flags = computeBillManagementFlags(hasPerm);
      expect(flags.canCloseCycle).toBe(true);

      const noPerm = makeHasPermission(['bill:view_branch']);
      const noFlags = computeBillManagementFlags(noPerm);
      expect(noFlags.canCloseCycle).toBe(false);
    });
  });

  describe('Multi-Role Dynamic UI Profiles', () => {
    it('Role: Branch Clerk (only bill:view_branch, bill:view_drafts, bill:create, bill:submit)', () => {
      const clerk = makeHasPermission(['bill:view_branch', 'bill:view_drafts', 'bill:create', 'bill:submit']);
      const mgmt = computeBillManagementFlags(clerk);
      expect(mgmt.canAccessPage).toBe(true);
      expect(mgmt.canViewDrafts).toBe(true);
      expect(mgmt.canSubmitBills).toBe(true);
      expect(mgmt.canViewPending).toBe(false);
      expect(mgmt.canApproveBills).toBe(false);
      expect(mgmt.canAudit).toBe(false);
      expect(mgmt.canResetDeleteBatch).toBe(false);
      expect(mgmt.canCloseCycle).toBe(false);

      const detail = computeBillDetailsFlags('Draft', clerk);
      expect(detail.canSubmit).toBe(true);
    });

    it('Role: Branch Manager (bill:view_branch, bill:view_pending, bill:approve, bill:rework)', () => {
      const manager = makeHasPermission(['bill:view_branch', 'bill:view_pending', 'bill:approve', 'bill:rework']);
      const mgmt = computeBillManagementFlags(manager);
      expect(mgmt.canViewPending).toBe(true);
      expect(mgmt.canApproveBills).toBe(true);
      expect(mgmt.canAudit).toBe(true);
      expect(mgmt.canResetDeleteBatch).toBe(false);
      expect(mgmt.canCloseCycle).toBe(false);

      const pendingDetail = computeBillDetailsFlags('Pending', manager);
      expect(pendingDetail.canApprove).toBe(true);
      expect(pendingDetail.canRework).toBe(true);
    });

    it('Role: Cashier / Payment Collector (bill:view_branch, bill:view_paid, bill:view_awaiting_payment, bill:update)', () => {
      const cashier = makeHasPermission(['bill:view_branch', 'bill:view_paid', 'bill:view_awaiting_payment', 'bill:update']);
      const mgmt = computeBillManagementFlags(cashier);
      expect(mgmt.canSeeOutstandingTable).toBe(true);
      expect(mgmt.canSeePaidBillsTable).toBe(true);
      expect(mgmt.canManagePayment).toBe(true);
      expect(mgmt.canAudit).toBe(false);
      expect(mgmt.canResetDeleteBatch).toBe(false);

      const postedDetail = computeBillDetailsFlags('Posted', cashier);
      expect(postedDetail.canEditPayment).toBe(true);
      expect(postedDetail.canCorrect).toBe(false);
    });
  });


  describe('Row Actions in Outstanding & Paid Bills Tables (Permission Gated)', () => {
    it('1. View Details is shown to authorized viewers and hidden when viewer has no view permissions', () => {
      const viewer = makeHasPermission(['bill:view_branch']);
      expect(computeRowActionFlags(viewer).showViewDetails).toBe(true);

      const unauth = makeHasPermission([]);
      expect(computeRowActionFlags(unauth).showViewDetails).toBe(false);
    });

    it('2. Check Correction is shown ONLY for corrected/reversed bills to users with bill:correct or correction view permissions', () => {
      const corrector = makeHasPermission(['bill:correct']);
      const corrBill = { bill_number: 'CORR-BILL-100' };
      const normalBill = { bill_number: 'BILL-100' };

      expect(computeRowActionFlags(corrector, corrBill).showCheckCorrection).toBe(true);
      expect(computeRowActionFlags(corrector, normalBill).showCheckCorrection).toBe(false);

      const clerk = makeHasPermission(['bill:view_branch']);
      expect(computeRowActionFlags(clerk, corrBill).showCheckCorrection).toBe(false);
    });

    it('3. Print/Export Bill requires monthly export or bill send/post/branch permissions', () => {
      const printer = makeHasPermission(['bill:post']);
      expect(computeRowActionFlags(printer).showPrintExport).toBe(true);

      const noPrint = makeHasPermission(['bill:delete']);
      expect(computeRowActionFlags(noPrint).showPrintExport).toBe(false);
    });

    it('4. Edit Payment Status is gated by bill:update, bill:post, payments_create, or bill:manage_all', () => {
      const cashier = makeHasPermission(['bill:update']);
      expect(computeRowActionFlags(cashier).showEditPayment).toBe(true);

      const reader = makeHasPermission(['bill:view_drafts']);
      expect(computeRowActionFlags(reader).showEditPayment).toBe(false);
    });

    it('5. Dispute Invoice requires dispute/update/rework permissions and bill must not already be disputed', () => {
      const officer = makeHasPermission(['bill:rework']);
      expect(computeRowActionFlags(officer, { status: 'Pending' }).showDispute).toBe(true);
      expect(computeRowActionFlags(officer, { status: 'Disputed' }).showDispute).toBe(false);

      const onlyDelete = makeHasPermission(['bill:delete']);
      expect(computeRowActionFlags(onlyDelete, { status: 'Pending' }).showDispute).toBe(false);
    });

    it('6. Delete Record requires bill:delete or bill:manage_all', () => {
      const deleter = makeHasPermission(['bill:delete']);
      expect(computeRowActionFlags(deleter).showDelete).toBe(true);

      const nonDeleter = makeHasPermission(['bill:view_branch', 'bill:view_paid']);
      expect(computeRowActionFlags(nonDeleter).showDelete).toBe(false);
    });

    it('Complete lockdown: User with no action permissions gets hasAnyRowAction === false (renders "—")', () => {
      const lockedOut = makeHasPermission([]);
      const flags = computeRowActionFlags(lockedOut, { status: 'Pending' });
      expect(flags.hasAnyRowAction).toBe(false);
      expect(flags.showViewDetails).toBe(false);
      expect(flags.showCheckCorrection).toBe(false);
      expect(flags.showPrintExport).toBe(false);
      expect(flags.showEditPayment).toBe(false);
      expect(flags.showDispute).toBe(false);
      expect(flags.showDelete).toBe(false);
    });

    it('Wildcard bill:manage_all unlocks all permitted row actions', () => {
      const admin = makeHasPermission(['bill:manage_all']);
      const flags = computeRowActionFlags(admin, { bill_number: 'CORR-123', status: 'Pending' });
      expect(flags.showViewDetails).toBe(true);
      expect(flags.showCheckCorrection).toBe(true);
      expect(flags.showPrintExport).toBe(true);
      expect(flags.showEditPayment).toBe(true);
      expect(flags.showDispute).toBe(true);
      expect(flags.showDelete).toBe(true);
      expect(flags.hasAnyRowAction).toBe(true);
    });
  });

});
