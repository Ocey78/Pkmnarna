"""Validated extension input and native HTML hosting; never guesses a patch version."""
import hashlib,json,pathlib,re,stat,zipfile
ZIP_HASH='1063e69857098b21ff7e70fa2d1eb9a9808e8ba85972eba8b30eba01e6115a0d'
VERSION='1.9.56'
ENTRY='play-online/assets/index-BBhViti1.js'
def find_extension(root):
    candidates=list(pathlib.Path(root).glob('Rocket-Menu-Firefox-1.9.56*.zip'))
    candidates+=list((pathlib.Path(root)/'extensions').glob('Rocket-Menu-Firefox-1.9.56*.zip'))
    valid=[p for p in candidates if p.stat().st_size<=32*1024*1024 and hashlib.sha256(p.read_bytes()).hexdigest()==ZIP_HASH]
    if not valid:raise FileNotFoundError('Upload the unchanged Rocket-Menu-Firefox-1.9.56.zip to this repository root. No new site was published.')
    return sorted(valid)[0]
def extract_extension(archive,destination):
    data=pathlib.Path(archive).read_bytes()
    if hashlib.sha256(data).hexdigest()!=ZIP_HASH:raise ValueError('Rocket Menu ZIP fingerprint mismatch')
    dest=pathlib.Path(destination)
    with zipfile.ZipFile(archive) as z:
        items=z.infolist()
        if len(items)>256 or sum(i.file_size for i in items)>64*1024*1024:raise ValueError('Extension archive exceeds limits')
        names=set()
        for item in items:
            p=pathlib.PurePosixPath(item.filename)
            if p.is_absolute() or '..' in p.parts or '\\' in item.filename or item.filename in names or stat.S_ISLNK(item.external_attr>>16):raise ValueError('Unsafe extension path')
            names.add(item.filename)
        manifest=json.loads(z.read('manifest.json'))
        if manifest.get('name')!='Rocket Menu' or manifest.get('version')!=VERSION:raise ValueError('Wrong Rocket Menu version')
        dest.mkdir(parents=True,exist_ok=True)
        z.extractall(dest)
    return manifest

def native_html(html,old_base,base):
    html=html.replace(old_base,base)
    entry=base+ENTRY
    pattern=r'(<script\b[^>]*\bsrc=["\'])'+re.escape(entry)+r'(?:\?[^"\']*)?(["\'][^>]*>)'
    html,count=re.subn(pattern,lambda m:m[1]+entry+'?rocket='+VERSION+'-'+ZIP_HASH[:12]+'-mobile1'+m[2],html)
    if count!=1:raise ValueError('Expected exactly one cached native entry')
    network='<script src="'+base+'network.js"></script>'
    if html.count(network)!=1:raise ValueError('Expected one hosting network script')
    menu='<script src="'+base+'rocket-menu.js"></script>'
    html=html.replace(menu,'')
    return html.replace(network,network+menu)
