export interface Customer {
  id: number;
  display_code?: string;
  full_name: string;
  phone: string;
  permanent_address: string;
  temporary_address?: string | null;
}

export interface CustomerCreate {
  full_name: string;
  phone: string;
  permanent_address: string;
  temporary_address?: string;
}

export interface CustomerUpdate {
  full_name: string;
  phone: string;
  permanent_address: string;
  temporary_address?: string;
}
