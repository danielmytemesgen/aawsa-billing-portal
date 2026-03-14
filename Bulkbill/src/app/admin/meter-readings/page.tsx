
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Search, UploadCloud, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AddMeterReadingForm, type AddMeterReadingFormValues } from "@/components/add-meter-reading-form";
import MeterReadingsTable from "@/components/meter-readings-table";
import { useToast } from "@/hooks/use-toast";
import { 
  addIndividualCustomerReading,
  addBulkMeterReading,
  getCustomers, 
  initializeCustomers, 
  getBulkMeters, 
  initializeBulkMeters,
  getIndividualCustomerReadings,
  initializeIndividualCustomerReadings,
  subscribeToIndividualCustomerReadings,
  getBulkMeterReadings,
  initializeBulkMeterReadings,
  subscribeToBulkMeterReadings,
  subscribeToCustomers,
  subscribeToBulkMeters
} from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import type { DisplayReading } from "@/lib/data-store";
import { format } from "date-fns";
import { CsvReadingUploadDialog } from "@/components/csv-reading-upload-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination } from "@/components/ui/table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";

interface User {
  id?: string;
  email: string;
  role: "admin" | "staff";
  branchName?: string;
}

export default function AdminMeterReadingsPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isIndividualCsvModalOpen, setIsIndividualCsvModalOpen] = React.useState(false);
  const [isBulkCsvModalOpen, setIsBulkCsvModalOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  
  const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);

  const [individualReadings, setIndividualReadings] = React.useState<DisplayReading[]>([]);
  const [bulkReadings, setBulkReadings] = React.useState<DisplayReading[]>([]);
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState(""); 

  const [individualPage, setIndividualPage] = React.useState(0);
  const [individualRowsPerPage, setIndividualRowsPerPage] = React.useState(10);
  const [bulkPage, setBulkPage] = React.useState(0);
  const [bulkRowsPerPage, setBulkRowsPerPage] = React.useState(10);


  const combineAndSortReadings = React.useCallback(() => {
    const individualReadingsRaw = getIndividualCustomerReadings();
    const bulkReadingsRaw = getBulkMeterReadings();
    const customers = getCustomers();
    const bulkMeters = getBulkMeters();

    const displayedIndividualReadings: DisplayReading[] = individualReadingsRaw.map(r => {
        const customer = customers.find(c => c.customerKeyNumber === r.individualCustomerId);
        return {
            id: r.id,
            meterId: r.individualCustomerId,
            meterType: 'individual' as const,
            meterIdentifier: customer ? `${customer.name} (M: ${customer.meterNumber})` : `Cust. ID: ${r.individualCustomerId}`,
            readingValue: r.readingValue,
            readingDate: r.readingDate,
            monthYear: r.monthYear,
            notes: r.notes
        };
    }).sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());

    const displayedBulkReadings: DisplayReading[] = bulkReadingsRaw.map(r => {
        const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === r.bulkMeterId);
        return {
            id: r.id,
            meterId: r.bulkMeterId,
            meterType: 'bulk' as const,
            meterIdentifier: bulkMeter ? `${bulkMeter.name} (M: ${bulkMeter.meterNumber})` : `BM ID: ${r.bulkMeterId}`,
            readingValue: r.readingValue,
            readingDate: r.readingDate,
            monthYear: r.monthYear,
            notes: r.notes
        };
    }).sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());
    
    setIndividualReadings(displayedIndividualReadings);
    setBulkReadings(displayedBulkReadings);
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        if (isMounted) setCurrentUser(parsedUser);
      } catch (e) { console.error("Failed to parse user from localStorage", e); }
    }

    setIsLoading(true);
    Promise.all([
      initializeCustomers(),
      initializeBulkMeters(),
      initializeIndividualCustomerReadings(),
      initializeBulkMeterReadings(),
    ]).then(() => {
      if (!isMounted) return;
      setAllCustomers(getCustomers());
      setAllBulkMeters(getBulkMeters());
      combineAndSortReadings();
      setIsLoading(false);
    }).catch(error => {
      if (!isMounted) return;
      console.error("Error initializing data for meter readings page:", error);
      toast({ title: "Error Loading Data", description: "Could not load necessary data.", variant: "destructive" });
      setIsLoading(false);
    });
    
    const unsubCust = subscribeToCustomers((updated) => { if(isMounted) { setAllCustomers(updated); combineAndSortReadings(); }});
    const unsubBM = subscribeToBulkMeters((updated) => { if(isMounted) { setAllBulkMeters(updated); combineAndSortReadings(); }});
    const unsubIndiReadings = subscribeToIndividualCustomerReadings(() => { if(isMounted) combineAndSortReadings(); });
    const unsubBulkReadings = subscribeToBulkMeterReadings(() => { if(isMounted) combineAndSortReadings(); });
    
    return () => { 
        isMounted = false; 
        unsubCust();
        unsubBM();
        unsubIndiReadings();
        unsubBulkReadings();
    };
  }, [toast, combineAndSortReadings]);

  const handleAddReadingSubmit = async (formData: AddMeterReadingFormValues) => {
    const readerId = currentUser?.id; 
    const { entityId, meterType, reading, date } = formData;
    
    setIsLoading(true);
    let result;

    try {
      if (meterType === 'individual_customer_meter') {
        result = await addIndividualCustomerReading({
          individualCustomerId: entityId,
          readerStaffId: readerId,
          readingDate: format(date, "yyyy-MM-dd"),
          monthYear: format(date, "yyyy-MM"),
          readingValue: reading,
          isEstimate: false,
          notes: `Reading entered by ${currentUser?.email || 'Admin'}`,
        });
      } else {
        result = await addBulkMeterReading({
          bulkMeterId: entityId,
          readerStaffId: readerId,
          readingDate: format(date, "yyyy-MM-dd"),
          monthYear: format(date, "yyyy-MM"),
          readingValue: reading,
          isEstimate: false,
          notes: `Reading entered by ${currentUser?.email || 'Admin'}`,
        });
      }

      if (result.success && result.data) {
        toast({
          title: "Meter Reading Added",
          description: `Reading for selected meter has been successfully recorded.`,
        });
        setIsModalOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Submission Failed",
          description: result.message || "Could not record meter reading.",
        });
      }
    } catch (error) {
      console.error("Error submitting meter reading:", error);
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: "An unexpected error occurred while saving the reading.",
      });
    } finally {
        setIsLoading(false);
    }
  };
  
  const filteredIndividualReadings = individualReadings.filter(reading => {
    if (!searchTerm) return true;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return reading.meterIdentifier.toLowerCase().includes(lowerSearchTerm) ||
           String(reading.readingValue).includes(lowerSearchTerm) ||
           reading.readingDate.includes(lowerSearchTerm) ||
           reading.monthYear.includes(lowerSearchTerm);
  });
  
  const paginatedIndividualReadings = filteredIndividualReadings.slice(
    individualPage * individualRowsPerPage,
    individualPage * individualRowsPerPage + individualRowsPerPage
  );
  
  const filteredBulkReadings = bulkReadings.filter(reading => {
    if (!searchTerm) return true;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return reading.meterIdentifier.toLowerCase().includes(lowerSearchTerm) ||
           String(reading.readingValue).includes(lowerSearchTerm) ||
           reading.readingDate.includes(lowerSearchTerm) ||
           reading.monthYear.includes(lowerSearchTerm);
  });

  const paginatedBulkReadings = filteredBulkReadings.slice(
    bulkPage * bulkRowsPerPage,
    bulkPage * bulkRowsPerPage + bulkRowsPerPage
  );


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Meter Readings Management</h1>
        <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search readings..." 
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {hasPermission('meter_readings_create') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isLoading && (allCustomers.length === 0 && allBulkMeters.length === 0)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Reading
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Add New Reading</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsModalOpen(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Manual Entry</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsIndividualCsvModalOpen(true)}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  <span>Upload Individual (CSV)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsBulkCsvModalOpen(true)}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  <span>Upload Bulk (CSV)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <Tabs defaultValue="individual">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Individual Readings ({filteredIndividualReadings.length})</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Meter Readings ({filteredBulkReadings.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="individual">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Individual Customer Reading List</CardTitle>
                <CardDescription>View and manage all recorded readings for individual customers.</CardDescription>
              </CardHeader>
              <CardContent>
                 {isLoading && paginatedIndividualReadings.length === 0 ? (
                    <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                        Loading meter readings...
                    </div>
                 ) : (
                    <MeterReadingsTable data={paginatedIndividualReadings} />
                 )}
              </CardContent>
              {filteredIndividualReadings.length > 0 && (
                 <TablePagination
                    count={filteredIndividualReadings.length}
                    page={individualPage}
                    rowsPerPage={individualRowsPerPage}
                    onPageChange={setIndividualPage}
                    onRowsPerPageChange={(value) => {
                        setIndividualRowsPerPage(value);
                        setIndividualPage(0);
                    }}
                 />
              )}
            </Card>
          </TabsContent>
          <TabsContent value="bulk">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Bulk Meter Reading List</CardTitle>
                <CardDescription>View and manage all recorded readings for bulk meters.</CardDescription>
              </CardHeader>
              <CardContent>
                 {isLoading && paginatedBulkReadings.length === 0 ? (
                    <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                        Loading meter readings...
                    </div>
                 ) : (
                    <MeterReadingsTable data={paginatedBulkReadings} />
                 )}
              </CardContent>
              {filteredBulkReadings.length > 0 && (
                 <TablePagination
                    count={filteredBulkReadings.length}
                    page={bulkPage}
                    rowsPerPage={bulkRowsPerPage}
                    onPageChange={setBulkPage}
                    onRowsPerPageChange={(value) => {
                        setBulkRowsPerPage(value);
                        setBulkPage(0);
                    }}
                 />
              )}
            </Card>
          </TabsContent>
      </Tabs>
      
      {hasPermission('meter_readings_create') && (
        <>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <UIDialogTitle>Add New Meter Reading</UIDialogTitle>
                <UIDialogDescription>
                  Select the meter type, then the specific meter, and enter the reading details.
                </UIDialogDescription>
              </DialogHeader>
              <AddMeterReadingForm 
                  onSubmit={handleAddReadingSubmit} 
                  customers={allCustomers}
                  bulkMeters={allBulkMeters}
                  isLoading={isLoading}
              />
            </DialogContent>
          </Dialog>
          
          <CsvReadingUploadDialog
            open={isIndividualCsvModalOpen}
            onOpenChange={setIsIndividualCsvModalOpen}
            meterType="individual"
            meters={allCustomers}
            currentUser={currentUser}
          />
          <CsvReadingUploadDialog
            open={isBulkCsvModalOpen}
            onOpenChange={setIsBulkCsvModalOpen}
            meterType="bulk"
            meters={allBulkMeters}
            currentUser={currentUser}
          />
        </>
      )}
    </div>
  );
}
