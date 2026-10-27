import {activePublicationQuery} from './listing-policy';
const wrapped=new WeakMap<object,object>();
/** D1 and Neon must apply the same expiry rule to every public query. */
export function publicationD1<T extends {prepare(query:string):unknown}>(database:T):T{
 let result=wrapped.get(database);if(!result){result=new Proxy(database,{get(target,key){if(key==='prepare')return (query:string)=>target.prepare(activePublicationQuery(query));const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});wrapped.set(database,result);}return result as T;
}
