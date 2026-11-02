import {AdminPanel} from "@/components/AdminPanel";
import {adminPageUser} from "@/lib/admin-page";
import "../pages.css";
export const dynamic="force-dynamic";
export const metadata={title:"Yönetim merkezi | estatemarket24",robots:{index:false,follow:false}};
export default async function AdminPage(){await adminPageUser();return <AdminPanel/>;}
