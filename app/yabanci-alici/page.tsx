import {ForeignBuyerGuide} from '@/components/ForeignBuyerGuide';
import {ForeignBuyerServices} from '@/components/ServiceSuggestions';
// Stand-alone page for the foreign buyer guide (also shown on the home page), opened by default,
// followed by the legal and finance categories of the service directory (/hizmetler).
export default function ForeignBuyerPage(){return <main className="foreign-buyer-page"><ForeignBuyerGuide open heading="h1"/><ForeignBuyerServices/></main>;}
