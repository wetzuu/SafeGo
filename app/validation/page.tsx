import { notFound } from "next/navigation";
import { ValidationWorkbench } from "@/components/safego/ValidationWorkbench";

export default function ValidationPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ValidationWorkbench />;
}
