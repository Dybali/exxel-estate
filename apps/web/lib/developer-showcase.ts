import records from '@/data/developer-showcase.json';
import type {Company} from './companies';
export const SAMPLE_DEVELOPERS:Company[]=records.map(record=>({...record,category:'developer'}));
