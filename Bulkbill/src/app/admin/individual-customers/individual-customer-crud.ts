import { dbCreateCustomer, dbGetAllCustomers, dbUpdateCustomer, dbDeleteCustomer } from '@/lib/db-queries';

interface IndividualCustomer {
  id: string;
  name: string;
  address: string;
  contact: string;
  meterId: string;
  created_at?: string;
}

export const createIndividualCustomer = async (customer: IndividualCustomer): Promise<IndividualCustomer | null> => {
  if (!customer.id || !customer.name || !customer.address || !customer.contact || !customer.meterId) {
    throw new Error('All fields are required for a new individual customer.');
  }
  return await dbCreateCustomer(customer);
};

export const getAllIndividualCustomers = async (): Promise<IndividualCustomer[]> => {
  return await dbGetAllCustomers();
};

export const getIndividualCustomerById = async (id: string): Promise<IndividualCustomer | null> => {
  const results: any = await dbGetAllCustomers();
  return results.find((r: any) => r.id === id) ?? null;
};

export const updateIndividualCustomer = async (id: string, updatedCustomer: Partial<IndividualCustomer>): Promise<IndividualCustomer | null> => {
  return await dbUpdateCustomer(id, updatedCustomer);
};

export const deleteIndividualCustomer = async (id: string): Promise<boolean> => {
  return await dbDeleteCustomer(id);
};