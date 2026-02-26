export interface Customer {
  id: number;
  name: string;
  phone: string;
  total_debt: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  customer_id: number;
  amount: number;
  description: string;
  date: string;
  closure_id?: number | null;
}
