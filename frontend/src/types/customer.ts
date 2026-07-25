export interface Customer {
  id: number;
  full_name: string;
  phone: string;
  address: string;
}

export interface CustomerCreate {
  full_name: string;
  phone: string;
  address: string;
}

export interface CustomerUpdate {
  full_name: string;
  phone: string;
  address: string;
}