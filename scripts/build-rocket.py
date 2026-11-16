#!/usr/bin/env python3
"""Replace the old hosted unlocker with the exact uploaded Rocket Menu archive."""
import argparse,hashlib,json,os,pathlib,shutil,subprocess,tempfile
from datetime import datetime,timezone
from build import base_path
from asset_cache import write_inventory
from rocket_host import find_extension,extract_extension,native_html,ZIP_HASH,VERSION,ENTRY
ROOT=pathlib.Path(__file__).resolve().parents[1]
STOCK_HASH='06f753660f6405ce447fa04f9a53de87cf1a4e28108fed70bf7cee989ac905c7'
def build(seed,archive,output,base):
    seed=pathlib.Path(seed).resolve();output=pathlib.Path(output).resolve();base=base_path(base)
    previous=json.loads((seed/'build-report.json').read_text())
    if previous.get('sourceSHA256')!=STOCK_HASH:raise ValueError('The asset seed uses an unsupported engine')
    old_base=base_path(previous['base'])
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.rocket-build-',dir=output.parent) as temporary:
        work=pathlib.Path(temporary);stage=work/'site';stage.mkdir()
        ext=work/'extension';manifest=extract_extension(archive,ext)
        for folder in ('assets','play-online','data'):
            if (seed/folder).is_dir():shutil.copytree(seed/folder,stage/folder)
        for path in stage.rglob('*'):
            if path.is_file() and path.suffix in ('.js','.mjs','.css','.html') and path.relative_to(stage).as_posix()!=ENTRY:
                path.write_text(path.read_text().replace(old_base,base))
        audio=stage/'play-online/rocket-menu-audio';audio.mkdir(exist_ok=True)
        for name in ('boss-eon.mp3','boss-rayquaza-1.mp3','boss-rayquaza-2.mp3','boss-rayquaza-3.mp3','boss-sync.json'):
            shutil.copyfile(ext/'audio'/name,audio/name)
        paths=sorted('/'+p.relative_to(stage).as_posix() for p in stage.rglob('*') if p.is_file())
        urls=['https://poke2darena.com'+p for p in paths]
        asset_list=work/'assets.json';asset_list.write_text(json.dumps(urls))
        stock=seed/'compat/source.js'
        if not stock.is_file():stock=seed/ENTRY
        (stage/'compat').mkdir(exist_ok=True)
        proc=subprocess.run(['node',str(ROOT/'scripts/compile-rocket.mjs'),str(stock),str(ext),str(stage/ENTRY),str(stage/'compat/source.js'),base,str(asset_list),old_base],text=True,capture_output=True)
        if proc.returncode:raise RuntimeError(proc.stderr.strip())
        details=json.loads(proc.stdout.strip());print('ROCKET_PATCH',json.dumps(details),flush=True)
        html=native_html((seed/'play-online/index.html').read_text(),old_base,base)
        (stage/'play-online/index.html').write_text(html)
        shutil.copyfile(ROOT/'site/index.html',stage/'index.html')
        routing=(ROOT/'site/routing.mjs').read_text().replace('export function routeURL','function routeURL')
        (stage/'network.js').write_text('(()=>{\n"use strict";\n'+routing+'\n'+(ROOT/'site/network.js').read_text()+'\n})();\n')
        # The original menu script gets a local lexical browser API, not a global polyfill.
        bridge=(ROOT/'site/rocket-browser.js').read_text()
        (stage/'rocket-menu.js').write_text('(()=>{\n"use strict";\n'+bridge+'\nconst browser=rocketBrowserBridge();\n'+(ext/'menu.js').read_text()+'\n})();\n')
        config={'upstream':'https://poke2darena.com','base':base,'assets':paths}
        (stage/'runtime-config.js').write_text('globalThis.Poke2DHostConfig=Object.freeze('+json.dumps(config).replace('<','\\u003c')+');\n')
        (stage/'.nojekyll').touch()
        report={'schema':2,'buildStatus':'imported','builtAt':datetime.now(timezone.utc).isoformat(),
            'base':base,'sourceSHA256':STOCK_HASH,'extension':'Rocket Menu','extensionVersion':VERSION,
            'extensionArchiveSHA256':ZIP_HASH,'customLauncher':False,'hostOverlay':False,
            'oldRosterExtensionActive':False,'rosterEntries':1066,'staticResources':len(paths),
            'missingOptionalResources':previous.get('missingOptionalResources',[]),
            'officialMultiplayer':'unverified','physicalIPhone':'unverified',
            'note':'Uses only the uploaded Rocket Menu patch pipeline on hash-verified original code. Browser-only request interception and recovery launchers are not required.'}
        (stage/'build-report.json').write_text(json.dumps(report,indent=2))
        inventory=write_inventory(stage,report);report['assetCategories']=inventory['categories']
        (stage/'build-report.json').write_text(json.dumps(report,indent=2));write_inventory(stage,report)
        if output.exists():shutil.rmtree(output)
        shutil.move(stage,output)
        return report
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed',default=os.environ.get('ASSET_SEED_DIR',str(ROOT/'.asset-seed')))
    parser.add_argument('--extension',default=os.environ.get('ROCKET_EXTENSION_ZIP'))
    parser.add_argument('--base',default=os.environ.get('PAGES_BASE_PATH','/Pkmnarna/'))
    parser.add_argument('--output',default=str(ROOT/'dist'))
    args=parser.parse_args()
    try:
        archive=pathlib.Path(args.extension) if args.extension else find_extension(ROOT)
        result=build(args.seed,archive,args.output,args.base)
        print('Built Rocket Menu '+result['extensionVersion']+' with direct native entry; no custom launcher.')
    except Exception as error:raise SystemExit('Rocket build stopped: '+str(error))
