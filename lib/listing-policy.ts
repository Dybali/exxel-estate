export const INDIVIDUAL_PUBLICATION_DAYS=20;
// Individual members may submit one listing every 45 days (exact elapsed time, same as the
// database triggers: PostgreSQL interval '45 days', SQLite '+45 days').
export const INDIVIDUAL_SUBMISSION_DAYS=45;
export function nextIndividualSubmission(last:string){return new Date(Date.parse(last)+INDIVIDUAL_SUBMISSION_DAYS*86400000).toISOString();}
export function listingExpired(expires:unknown,at=Date.now()){return typeof expires==='string'&&Number.isFinite(Date.parse(expires))&&Date.parse(expires)<=at;}
// Enforced at the database adapter so every public SELECT (search, AI, profiles,
// favorites, messages, sitemap and statistics) uses the same exact cutoff.
// Only server-generated ISO timestamps enter this SQL; user values remain bound.
export function activePublicationQuery(source:string,at=new Date()){
 if(!/^\s*(SELECT\b|WITH\b|INSERT\b[\s\S]*?\bSELECT\b)/i.test(source))return source;
 const stamp=at.toISOString();
 return source.replace(/(?<![\w.])(?:(\w+)\.)?status\s*=\s*'published'/g,(match,alias)=>`(${match} AND (${alias?alias+'.':''}expires_at IS NULL OR ${alias?alias+'.':''}expires_at>'${stamp}'))`);
}
