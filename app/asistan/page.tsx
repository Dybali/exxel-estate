import type {Metadata} from 'next';
import {EstateAssistant} from '@/components/EstateAssistant';
export const metadata:Metadata={title:'Ev Asistanı | estatemarket24',description:'Türkçe, İngilizce, Almanca ve Arapça yazarak Türkiye’de satılık ve kiralık evleri keşfedin.'};
export default function AssistantPage(){return <EstateAssistant/>;}
