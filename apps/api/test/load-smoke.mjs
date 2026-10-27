// Explicit local-only capacity smoke test. Never load-test the public Site.
import {performance} from 'node:perf_hooks';
const base=process.env.API_TEST_BASE_URL||'http://127.0.0.1:4000';
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Load smoke must use an explicit local backend.');
const total=200,concurrency=10,latencies=[],failures=[];let next=0;
const start=performance.now();
await Promise.all(Array.from({length:concurrency},async()=>{for(;;){const index=next++;if(index>=total)return;const began=performance.now();try{const response=await fetch(base+'/api/listings?currency=TRY&purpose=satilik&sort=priceAsc');const data=await response.json();if(response.status!==200||!Array.isArray(data.listings))failures.push({index,status:response.status});}catch{failures.push({index,status:'network_error'});}latencies.push(performance.now()-began);}}));
latencies.sort((a,b)=>a-b);const elapsed=performance.now()-start;
const report={requests:total,concurrency,failures:failures.length,durationSeconds:Number((elapsed/1000).toFixed(2)),p50Ms:Math.round(latencies[Math.floor(latencies.length*.5)]),p95Ms:Math.round(latencies[Math.floor(latencies.length*.95)]),maxMs:Math.round(latencies.at(-1)),scope:'Local API with configured Neon. Not a 1000-user production capacity result.'};
console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
