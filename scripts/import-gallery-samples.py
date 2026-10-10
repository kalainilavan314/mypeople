from pathlib import Path
import urllib.request, urllib.parse, json, re, html, io
from PIL import Image, ImageOps
root=Path(__file__).resolve().parents[1]
out=root/'app/public/gallery'
out.mkdir(parents=True,exist_ok=True)
files=[('library','Jaffna Public Library.jpg','Jaffna Public Library','யாழ்ப்பாணப் பொது நூலகம்'),('reading','Interior of Public Library, Jaffna.jpg','Inside Jaffna Public Library','யாழ்ப்பாண நூலகத்தின் உள்ளே'),('nallur','Nallur Kandaswamy temple.jpg','Nallur Kandaswamy temple','நல்லூர் கந்தசுவாமி கோவில்'),('fields','Jaffna beauty.jpg','Jaffna landscape','யாழ்ப்பாணத்தின் இயற்கை'),('kilinochchi','Kilinochchi Nature.jpg','Kilinochchi landscape','கிளிநொச்சியின் இயற்கை')]
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'MyPeopleDesignPreview/1.0 (sample civic gallery assets)'})
    return urllib.request.urlopen(req,timeout=45).read()
def clean(x): return html.unescape(re.sub('<[^>]+>','',x)).strip()
photos=[]
for id,title,en,ta in files:
    url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'action':'query','format':'json','titles':'File:'+title,'prop':'imageinfo','iiprop':'url|extmetadata'})
    result=json.loads(get(url))
    page=next(iter(result['query']['pages'].values()))
    info=page['imageinfo'][0]; meta=info['extmetadata']
    license=clean(meta['LicenseShortName']['value'])
    if not (license.startswith('CC BY') or license=='Public domain' or license=='CC0'): raise ValueError(license)
    raw=get(info['url'])
    image=ImageOps.exif_transpose(Image.open(io.BytesIO(raw)));image.thumbnail((1200,1200));image.convert('RGB').save(out/(id+'.webp'),'WEBP',quality=82)
    photos.append({'id':id,'src':'/gallery/'+id+'.webp','altEn':en,'altTa':ta,'credit':clean(meta['Artist']['value'])[:300]+' / Wikimedia Commons. Resized and converted to WebP.','sourceUrl':info['descriptionurl'],'license':license,'licenseUrl':clean(meta.get('LicenseUrl',{'value':'https://creativecommons.org/licenses/'})['value'])})
    print(id,license,(out/(id+'.webp')).stat().st_size)
albums=[]
titles=[('library','Jaffna library','யாழ்ப்பாண நூலகம்','community'),('reading','Spaces for learning','கற்றல் இடங்கள்','events'),('nallur','Nallur heritage','நல்லூர் மரபு','community'),('fields','Northern landscapes','வடக்கின் இயற்கை','community'),('kilinochchi','Kilinochchi green spaces','கிளிநொச்சியின் பசுமை','events')]
for id,en,ta,category in titles:
    photo=next(p for p in photos if p['id']==id)
    albums.append({'id':id,'titleEn':en,'titleTa':ta,'category':category,'publishedAt':'2026-10-09T12:00:00+05:30','place':en,'publisher':'Sample collection · Wikimedia Commons','sample':True,'publicationState':'published','photos':[photo]})
(root/'server/src/gallery-albums.json').write_text(json.dumps(albums,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'ATTRIBUTION.json').write_text(json.dumps(photos,ensure_ascii=False,indent=2),encoding='utf-8')
