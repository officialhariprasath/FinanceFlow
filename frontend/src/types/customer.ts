export type IdType = "AADHAAR" | "VOTER" | "PAN" | "DL";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type Occupation = "SALARY" | "SHOP" | "DAILY_WAGE" | "OTHER";
export type HouseOwnership = "OWN" | "RENT";

export interface CustomerKycFields {
  id_type?: IdType | null;
  id_number?: string | null;
  alternate_phone?: string | null;
  date_of_birth?: string | null;
  gender?: Gender | null;
  occupation?: Occupation | null;
  business_name?: string | null;
  monthly_income?: string | number | null;
  area_landmark?: string | null;
  house_ownership?: HouseOwnership | null;
  guarantor_name?: string | null;
  guarantor_phone?: string | null;
  reference1_name?: string | null;
  reference1_phone?: string | null;
  reference2_name?: string | null;
  reference2_phone?: string | null;
  has_other_loans?: boolean | null;
  other_loans_emi?: string | number | null;
}

export interface Customer extends CustomerKycFields {
  id: number;
  display_code?: string;
  full_name: string;
  phone: string;
  permanent_address: string;
  temporary_address?: string | null;
}

export interface CustomerCreate extends CustomerKycFields {
  full_name: string;
  phone: string;
  permanent_address: string;
  temporary_address?: string;
  require_full_kyc?: boolean;
}

export type CustomerUpdate = CustomerCreate;
