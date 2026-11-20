import BorrowerKycForm from "./BorrowerKycForm";
import type { Customer, CustomerCreate } from "../../types/customer";

type CustomerFormProps = {
  initialData?: Customer | null;
  loading: boolean;
  onSubmit: (data: CustomerCreate) => void;
  onCancel: () => void;
};

export default function CustomerForm({
  initialData,
  loading,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  return (
    <BorrowerKycForm
      initialData={initialData}
      loading={loading}
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitLabel={initialData ? "Save changes" : "Save borrower"}
    />
  );
}
