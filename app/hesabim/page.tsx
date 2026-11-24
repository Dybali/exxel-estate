import "../lead-board.css";
import "../account-pro.css";
import "../overview.css";
import { Dashboard } from "@/components/Dashboard";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Suspense } from "react";
export default function AccountPage(){return <Suspense fallback={<PageSkeleton variant="account"/>}><Dashboard/></Suspense>}
