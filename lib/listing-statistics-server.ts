import {db} from './server';import {ensureStatistics,type StatisticsDatabase} from './listing-statistics';
let initialized:Promise<unknown>|undefined;
export async function statisticsDB(){const database=db() as unknown as StatisticsDatabase;if(!initialized)initialized=ensureStatistics(database).catch(e=>{initialized=undefined;throw e;});await initialized;return database;}
