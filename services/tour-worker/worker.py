"""One durable queue consumer. Database and private files stay on the Site."""
import json,logging,os,signal,tempfile,threading,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse
from stitch import stitch,StitchError

logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
BASE=os.environ.get('CAPTURE_SITE_URL','').rstrip('/')
TOKEN=os.environ.get('CAPTURE_WORKER_TOKEN','')
BIN=os.environ.get('HUGIN_BIN','/usr/bin')
STOP=threading.Event()
if urlparse(BASE).scheme!='https' and not (os.environ.get('CAPTURE_ALLOW_LOCAL')=='1' and urlparse(BASE).hostname in ('localhost','127.0.0.1')):raise SystemExit('An HTTPS Site URL is required')
if len(TOKEN)<32:raise SystemExit('A shared secret of at least 32 characters is required')

def api(path,method='POST',data=None,lease=None,raw=False):
    headers={'Authorization':'Bearer '+TOKEN}
    if lease:headers['X-Capture-Lease']=lease
    if data is not None:
        if isinstance(data,bytes):headers['Content-Type']='image/jpeg'
        else:data=json.dumps(data).encode();headers['Content-Type']='application/json'
    request=Request(BASE+'/api/tour-capture/worker/'+path,data=data,method=method,headers=headers)
    # Never forward the bearer credential through redirects.
    import urllib.request
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    with urllib.request.build_opener(NoRedirect).open(request,timeout=45) as response:
        limit=6_000_001 if raw else 100_000
        content=response.read(limit)
        if raw and len(content)>6_000_000:raise StitchError('input','Download exceeds limit')
        return content if raw else json.loads(content)

def process(job):
    job_id=job['id'];lease=job['lease'];progress=[5];done=threading.Event();lost=threading.Event()
    def heartbeat():
        failures=0
        while not done.wait(20):
            try:api(job_id+'/heartbeat',data={'progress':progress[0]},lease=lease);failures=0
            except HTTPError as exc:
                if exc.code in (401,409):lost.set();return
                failures+=1
            except Exception:failures+=1
            if failures>=3:lost.set();return
    thread=threading.Thread(target=heartbeat,daemon=True);thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix='estate-tour-') as temp:
            root=Path(temp);source=root/'source';source.mkdir()
            count=int(job['count'])
            if not 12<=count<=40:raise StitchError('input','Invalid count')
            for i in range(count):
                if lost.is_set() or STOP.is_set():raise StitchError('canceled','Lease lost or worker stopping')
                (source/f'{i:03}.jpg').write_bytes(api(f'{job_id}/source/{i}',method='GET',lease=lease,raw=True))
            def set_progress(value):
                if lost.is_set() or STOP.is_set():raise StitchError('canceled','Lease lost or worker stopping')
                progress[0]=value
            result,report=stitch(source,root/'output',BIN,set_progress,job.get('hfov'))
            if lost.is_set() or STOP.is_set():raise StitchError('canceled','Lease lost or worker stopping')
            api(job_id+'/result',method='PUT',data=result.read_bytes(),lease=lease)
            logging.info('Job %s completed: %s',job_id,report)
    except Exception as exc:
        code=getattr(exc,'code','processing')
        logging.warning('Job %s failed (%s)',job_id,code)
        if not lost.is_set() and code!='canceled':
            try:api(job_id+'/fail',data={'code':code},lease=lease)
            except Exception:logging.warning('Could not acknowledge failed job')
    finally:done.set();thread.join(timeout=2)

if __name__=='__main__':
    for sig in (signal.SIGINT,signal.SIGTERM):signal.signal(sig,lambda *_:STOP.set())
    once=os.environ.get('CAPTURE_RUN_ONCE')=='1'
    while not STOP.is_set():
        try:
            job=api('claim',data={}).get('job')
            if job:process(job)
            elif once:break
        except Exception as exc:logging.warning('Queue unavailable (%s)',type(exc).__name__)
        if once:break
        STOP.wait(10)
