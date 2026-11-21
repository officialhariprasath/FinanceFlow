export type IdType = "AADHAAR" | "VOTER" | "PAN" | "DL";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type Occupation = string;
export type HouseOwnership = "OWN" | "RENT";

export interface CustomerKycFields {
  id_type?: IdType | null;
  id_number?: string | null;
  alternate_phone?: string | null;
  date_of_birth?: string | null;
  gender?: Gender | null;
  occupation?: Occupation | null;
  occupation_detail?: string | null;
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
  addr_line1?: string | null;
  addr_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  address_comment?: string | null;
  temp_addr_line1?: string | null;
  temp_addr_line2?: string | null;
  temp_city?: string | null;
  temp_state?: string | null;
  temp_postal_code?: string | null;
  temp_address_comment?: string | null;
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
  permanent_address?: string;
  temporary_address?: string;
  require_full_kyc?: boolean;
}

export type CustomerUpdate = CustomerCreate;

export type KycFieldRule = { enabled: boolean; required: boolean };

export type OccupationOption = { value: string; label: string };
