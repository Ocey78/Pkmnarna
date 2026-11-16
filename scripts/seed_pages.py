#!/usr/bin/env python3
"""Reuse this project's public deployment; verify every byte against its inventory."""
import argparse,hashlib,json,os,pathlib,re,time
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request,urlopen
SITE='https://ocey78.github.io/Pkmnarna/'
MAX_FILE=32*1024*1024
MAX_TOTAL=750*1024*1024

def records(manifest):
    files=manifest.get('files',[])
    if not isinstance(files,list) or not files or len(files)>15000:raise ValueError('Invalid asset inventory count')
    seen=set();total=0
    for record in files:
        name=record.get('path','');size=record.get('bytes');sha=record.get('sha256','')
        if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9_./-]+',name) or name.startswith('/') or any(part in ('..','.','') for part in name.split('/')) or name in seen:raise ValueError('Unsafe or duplicate seed path')
        if not isinstance(size,int) or size<0 or size>MAX_FILE or not re.fullmatch(r'[0-9a-f]{64}',sha):raise ValueError('Invalid seed size or digest')
        total+=size;seen.add(name)
    if total>MAX_TOTAL:raise ValueError('Seed exceeds total size limit')
    return files

def matches(data,record):
    return len(data)==record['bytes'] and hashlib.sha256(data).hexdigest()==record['sha256']

def download(path):
    request=Request(SITE+path,headers={'User-Agent':'Pkmnarna-Rocket-Importer/1.9.56'})
    for attempt in range(3):
        try:
            with urlopen(request,timeout=35) as response:
                if not response.url.startswith(SITE):raise ValueError('Unexpected seed redirect')
                data=response.read(MAX_FILE+1)
                if len(data)>MAX_FILE:raise ValueError('Seed file exceeds size limit')
                return data
        except Exception:
            if attempt==2:raise
            time.sleep(attempt+1)

def main(dest):
    dest=pathlib.Path(dest).resolve();dest.mkdir(parents=True,exist_ok=True)
    raw=download('asset-manifest.json');manifest=json.loads(raw);items=records(manifest)
    def copy(item):
        p=dest/item['path']
        if not p.resolve().is_relative_to(dest) or p.is_symlink():raise ValueError('Unsafe seed output')
        if p.is_file() and matches(p.read_bytes(),item):return
        data=download(item['path'])
        if not matches(data,item):raise ValueError('Published file changed or was corrupt: '+item['path'])
        p.parent.mkdir(parents=True,exist_ok=True)
        temp=p.with_name(p.name+'.download');temp.write_bytes(data);temp.replace(p)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for index,_ in enumerate(pool.map(copy,items),1):
            if index%250==0:print('Verified cached files:',index,'/',len(items),flush=True)
    (dest/'asset-manifest.json').write_bytes(raw)
    print('Verified all',len(items),'published seed files.',flush=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',default='.asset-seed');args=parser.parse_args();main(args.output)
