import { t as tr } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <div>
      <div className="page-h"><div><h1>{tr("universities")}</h1><p>{tr("universitiesDesc")}</p></div></div>
      <div className="empty"><b>{tr("underPrep")}</b></div>
    </div>
  );
}
