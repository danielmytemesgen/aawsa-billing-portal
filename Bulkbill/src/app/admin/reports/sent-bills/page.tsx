
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { BillTable } from "../bill-table";
import { 
  getBills, initializeBills, subscribeToBills,
  getCustomers, initializeCustomers, subscribeToCustomers,
  getBulkMeters, initializeBulkMeters, subscribeToBulkMeters,
  getBranches, initializeBranches, subscribeToBranches 
} from "@/lib/data-store";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import { Send, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { StaffMember } from "@/app/admin/staff-management/staff-types";
import type { Branch } from "@/app/admin/branches/branch-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";


export default function SentBillsReportPage() {
  const { hasPermission } = usePermissions();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);

  const [bills, setBills] = React.useState<DomainBill[]>([]);
  const [customers, setCustomers] = React.useState<IndividualCustomer[]>([]);
  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("all");
  
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  
  React.useEffect(() => {
    const user = localStorage.getItem("user");
    if(user) {
      const parsedUser = JSON.parse(user);
      setCurrentUser(parsedUser);
      // If user is Staff Management, lock filter to their branch
      if (parsedUser.role?.toLowerCase() === 'staff management' && parsedUser.branchId) {
        setSelectedBranchId(parsedUser.branchId);
      }
    }

    const fetchData = async () => {
        setIsLoading(true);
        await Promise.all([
            initializeBills(),
            initializeCustomers(),
            initializeBulkMeters(),
            initializeBranches(),
        ]);
        setBills(getBills());
        setCustomers(getCustomers());
        setBulkMeters(getBulkMeters());
        setBranches(getBranches());
        setIsLoading(false);
    };
    fetchData();

    const unsubBills = subscribeToBills(setBills);
    const unsubCustomers = subscribeToCustomers(setCustomers);
    const unsubBms = subscribeToBulkMeters(setBulkMeters);
    const unsubBranches = subscribeToBranches(setBranches);

    return () => {
        unsubBills();
        unsubCustomers();
        unsubBms();
        unsubBranches();
    };
  }, []);

  const filteredBills = React.useMemo(() => {
    let visibleBills = [...bills];
    
    // Branch filter based on UI selection or locked user role
    const branchIdToFilter = currentUser?.role?.toLowerCase() === 'staff management' ? currentUser.branchId : selectedBranchId;
    
    if (branchIdToFilter && branchIdToFilter !== "all") {
        visibleBills = visibleBills.filter(bill => {
            const entityId = bill.individualCustomerId || bill.bulkMeterId;
            if (!entityId) return false;

            const customer = customers.find(c => c.customerKeyNumber === entityId);
            if (customer) {
                // Direct match on customer's branch
                if (customer.branchId === branchIdToFilter) return true;
                // Indirect match via customer's bulk meter's branch
                if (customer.assignedBulkMeterId) {
                    const bm = bulkMeters.find(b => b.customerKeyNumber === customer.assignedBulkMeterId);
                    if (bm?.branchId === branchIdToFilter) return true;
                }
                return false;
            }

            // Direct match on bulk meter's branch
            const bulkMeter = bulkMeters.find(b => b.customerKeyNumber === entityId);
            if (bulkMeter?.branchId === branchIdToFilter) return true;

            return false;
        });
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      visibleBills = visibleBills.filter(bill => {
        const customerKey = bill.individualCustomerId || bill.bulkMeterId;
        return customerKey?.toLowerCase().includes(lowercasedTerm);
      });
    }

    return visibleBills.sort((a, b) => new Date(b.billPeriodEndDate).getTime() - new Date(a.billPeriodEndDate).getTime());
  }, [bills, customers, bulkMeters, searchTerm, selectedBranchId, currentUser]);
  
  const paginatedBills = filteredBills.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Send className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle>List of All Sent Bills</CardTitle>
                    <CardDescription>A comprehensive, real-time list of all generated bills in the system.</CardDescription>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-grow md:flex-grow-0">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by Customer Key..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {hasPermission('reports_generate_all') && (
                  <Select value={selectedBranchId || undefined} onValueChange={setSelectedBranchId}>
                      <SelectTrigger className="w-full md:w-[200px]">
                          <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Branches</SelectItem>
                          {branches.map((branch) => (
                              branch?.id !== undefined && branch?.id !== null ? (
                                <SelectItem key={String(branch.id)} value={String(branch.id)}>
                                  {branch.name}
                                </SelectItem>
                              ) : null
                          ))}
                      </SelectContent>
                  </Select>
                )}
              </div>
           </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading all bills...</div>
          ) : (
            <BillTable bills={paginatedBills} customers={customers} bulkMeters={bulkMeters} branches={branches} />
          )}
        </CardContent>
         {filteredBills.length > 0 && (
          <TablePagination
            count={filteredBills.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(value) => {
              setRowsPerPage(value);
              setPage(0);
            }}
          />
        )}
      </Card>
    </div>
  );
}
