type PhotoFile={name:string;size:number;type:string;lastModified:number};
export function supportedCapturePhoto(file:PhotoFile){return ['image/jpeg','image/png','image/webp'].includes(file.type)||!file.type&&/\.(jpe?g|png|webp)$/i.test(file.name);}
export function addCapturePhotos<T extends PhotoFile>(current:T[],incoming:T[]){
 const files=[...current],rejected:string[]=[];let overflow=false;
 const key=(file:T)=>`${file.name}\0${file.size}\0${file.lastModified}`,seen=new Set(current.map(key));
 for(const file of incoming){if(!supportedCapturePhoto(file)||!file.size||file.size>25_000_000){rejected.push(file.name);continue;}if(seen.has(key(file)))continue;if(files.length>=40){overflow=true;continue;}seen.add(key(file));files.push(file);}
 return {files,rejected,overflow};
}
