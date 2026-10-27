"""Bounded Hugin pipeline. No generated pixels, stretching or silent partial output."""
import os,re,subprocess,threading,time
from pathlib import Path
from PIL import Image,ImageOps
import numpy as np

class StitchError(Exception):
    def __init__(self,code,message):
        super().__init__(message);self.code=code

def stitch(source,destination,binpath,progress=lambda percent:None,hfov=None):
    source,destination,binpath=map(Path,(source,destination,binpath))
    files=sorted(source.glob('*.jpg'))
    if not 12<=len(files)<=40:raise StitchError('input','12–40 JPEGs required')
    destination.mkdir(exist_ok=False)
    env={**os.environ,'PATH':str(binpath)+os.pathsep+os.environ.get('PATH',''),'OMP_NUM_THREADS':'2'}
    start=time.monotonic()
    def run(tool,*args):
        if time.monotonic()-start>900:raise StitchError('timeout','Job time limit exceeded')
        executable=binpath/(tool+('.exe' if os.name=='nt' else ''))
        with open(destination/(tool+'.log'),'wb') as log:
            process=subprocess.Popen([str(executable),*map(str,args)],cwd=destination,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            try:
                process.wait(timeout=min(180,900-(time.monotonic()-start)))
            except BaseException:
                process.kill();process.wait();raise
        if process.returncode:raise StitchError('processing',tool+' failed')
    normalized=destination/'input';normalized.mkdir()
    for index,file in enumerate(files):
        if file.stat().st_size>6_000_000:raise StitchError('input','JPEG exceeds size limit')
        with Image.open(file) as image:
            if image.format!='JPEG' or image.width*image.height>16_000_000:raise StitchError('input','Invalid JPEG dimensions')
            image=ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((1600,1600))
            # Keep focal-length EXIF when no explicit FOV is supplied.
            image.save(normalized/f'{index:03}.jpg',quality=94,exif=image.getexif())
    progress(10)
    options=['-o','project.pto','-s','1']
    if hfov is not None:
        hfov=float(hfov)
        if not 35<=hfov<=110:raise StitchError('input','Invalid field of view')
        options+=['-p','0','-f',str(hfov)]
    run('pto_gen',*options,*[str(Path('input')/f'{i:03}.jpg') for i in range(len(files))])
    run('cpfind','--multirow','--ncores=2','-o','matched.pto','project.pto');progress(35)
    edges=[tuple(map(int,m)) for m in re.findall(r'^c n(\d+) N(\d+)',(destination/'matched.pto').read_text(encoding='utf-8'),re.M)]
    reached={0}
    for _ in files:
        for a,b in edges:
            if a in reached or b in reached:reached.update((a,b))
    if len(reached)!=len(files):raise StitchError('overlap','Not all photos overlap')
    run('cpclean','-o','clean.pto','matched.pto')
    run('autooptimiser','-a','-m','-l','-s','-o','optimized.pto','clean.pto');progress(55)
    run('pano_modify','--projection=2','--fov=360x180','--canvas=2048x1024','--crop=0,2048,0,1024','-o','render.pto','optimized.pto')
    run('nona','-t','2','-m','TIFF_m','-o','tile-','render.pto');progress(75)
    tiles=sorted(destination.glob('tile-*.tif'))
    if not tiles:raise StitchError('processing','No rendered tiles')
    run('enblend','--wrap=horizontal','--compression=DEFLATE','-o','merged.tif',*[p.name for p in tiles]);progress(90)
    with Image.open(destination/'merged.tif') as image:
        if image.size!=(2048,1024) or 'A' not in image.getbands():raise StitchError('coverage','Missing coverage information')
        coverage=float(np.mean(np.asarray(image.getchannel('A'))>0))
        # Fail closed: incomplete sphere is not sold as a complete tour.
        if coverage<.995:raise StitchError('coverage','Incomplete sphere: %.2f%%'%(coverage*100))
        result=destination/'panorama.jpg';image.convert('RGB').save(result,quality=93)
    return result,{'coverage':coverage,'matches':len(edges),'seconds':round(time.monotonic()-start,2)}
