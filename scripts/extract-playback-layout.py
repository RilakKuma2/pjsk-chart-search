"""Export playback layout and sprites from the installed APK, without Unity.
Usage: python3 scripts/extract-playback-layout.py /path/to/pjsekai_apk_latest
Requires UnityPy, Pillow and numpy. Does not modify the APKs.
"""
import json
import struct
import sys
import zipfile
from pathlib import Path
import numpy as np
from PIL import Image
import UnityPy

UnityPy.config.FALLBACK_UNITY_VERSION = '2022.3.21f1'
root = Path(__file__).resolve().parents[1]
zips = [zipfile.ZipFile(p) for p in Path(sys.argv[1]).glob('*.apk')]
entries = {n.rsplit('/', 1)[-1]: (z, n) for z in zips for n in z.namelist() if n.startswith('assets/bin/Data/')}
env = UnityPy.Environment()
loaded = {}
out = root / 'public/playback/layout'
out.mkdir(parents=True, exist_ok=True)

def load(name):
    name = name.rsplit('/', 1)[-1]
    if name not in loaded:
        parts = [entries[name + '.split' + str(i)] for i in range(100) if name + '.split' + str(i) in entries]
        if not parts:
            parts = [entries[name]]
        loaded[name] = env.load_file(b''.join(z.read(n) for z, n in parts), name=name)
    return loaded[name]

def resolve(file, ref):
    if not ref['m_PathID']:
        return None
    target = load(file.externals[ref['m_FileID'] - 1].path) if ref['m_FileID'] else file
    return target.objects[ref['m_PathID']]

def sprite(file, ref):
    o = resolve(file, ref)
    d = o.read_typetree()
    rd = d['m_RD']
    if d['m_SpriteAtlas']['m_PathID']:
        atlas = resolve(o.assets_file, d['m_SpriteAtlas'])
        rd = next(v for k, v in atlas.read_typetree()['m_RenderDataMap'] if k == d['m_RenderDataKey'])
        owner = atlas.assets_file
    else:
        owner = o.assets_file
    for key in ['texture', 'alphaTexture']:
        tex = resolve(owner, rd[key])
        if tex:
            stream = tex.read_typetree()['m_StreamData']['path']
            if stream:
                load(stream)
    s = o.read()
    image = s.image
    size = [round(d['m_Rect'][k]) for k in ['width', 'height']]
    if image.size != tuple(size):
        padded = Image.new('RGBA', size)
        offset = rd['textureRectOffset']
        padded.paste(image, (round(offset['x']), round(size[1] - offset['y'] - image.height)))
        image = padded
    name = d['m_Name'] + '.png'
    image.save(out / name)
    return {'image': name, 'size': [v/d['m_PixelsToUnits'] for v in size], 'pivot': [d['m_Pivot'][k] for k in 'xy']}

def prefab(name):
    f = load(name)
    data = {i: o.read_typetree(check_read=False) for i, o in f.objects.items()}
    transforms = {d['m_GameObject']['m_PathID']: i for i, d in data.items() if f.objects[i].type.name == 'Transform'}
    def matrix(i):
        t = data[i]
        # Root translations stage the offscreen views; local geometry excludes them.
        if not t['m_Father']['m_PathID']:
            return np.eye(4)
        x,y,z,w = [t['m_LocalRotation'][k] for k in 'xyzw']
        a = np.eye(4)
        a[:3,:3] = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]) @ np.diag([t['m_LocalScale'][k] for k in 'xyz'])
        a[:3,3] = [t['m_LocalPosition'][k] for k in 'xyz']
        return matrix(t['m_Father']['m_PathID']) @ a
    def item(i):
        d = data[i]
        go = d['m_GameObject']['m_PathID']
        result = {'name': data[go]['m_Name'], 'matrix': matrix(transforms[go]).flatten().tolist(), 'order': d.get('m_SortingOrder', 0), 'color': [d.get('m_Color',dict.fromkeys('rgba',1))[k] for k in 'rgba']}
        if d.get('m_Sprite', {}).get('m_PathID'):
            result.update(sprite(f, d['m_Sprite']))
        return result
    return f, data, transforms, item

back, bd, bt, bi = prefab('7ccedf6780c404baab54a7e063e2e693')
front, fd, ft, fi = prefab('426ec9b178b054fe38fd5d6e5cecce0a')
background = []
for i in [77,78,79,81,82,83,84,85,86,87,88,90,91,92,93,94]:
    obj = bi(i)
    if obj['name'] == 'Jacket':
        # Native music jackets are 740px; Sprite.Create uses the default 100 PPU.
        obj.update(image='$jacket',size=[7.4,7.4],pivot=[.5,.5])
        parent = bd[bt[bd[i]['m_GameObject']['m_PathID']]]['m_Father']['m_PathID']
        mask = next(j for j,d in bd.items() if back.objects[j].type.name=='SpriteMask' and bd[bt[d['m_GameObject']['m_PathID']]]['m_Father']['m_PathID']==parent)
        obj['mask'] = bi(mask)
        obj['mask']['cutoff'] = bd[mask]['m_MaskAlphaCutoff']
    elif obj['name'] == 'Background':
        # Bundle live/2dmode/background/default replaces this null sprite.
        obj.update(image='../background.webp',size=[2048/87.77143096923828,2048/87.77143096923828],pivot=[.5,.5])
    background.append(obj)
base_width,base_height,ppu,base_type = struct.unpack_from('<fffi',front.objects[538].get_raw_data(),32)
result = {'source': {'backgroundPrefab':back.name,'frontPrefab':front.name},
          'camera': {'width':base_width/ppu,'height':base_height/ppu,'baseType':base_type},
          'backgroundCamera': {'fov':bd[75]['field of view'],'position':[0,0,-10]},
          'background':background,
          'lanes':[fi(i) for i in [406,421,453]], 'pause':fi(445),
          'cover': {'area':fi(377), 'line':fi(399),
                    'minLineSize':list(struct.unpack_from('<ff',front.objects[550].get_raw_data(),56)),
                    'maxLineSize':list(struct.unpack_from('<ff',front.objects[550].get_raw_data(),64))}}
(root / 'src/chart-viewer/playbackLayout.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print('Exported native background, masks, lanes and pause button:',len(list(out.glob('*.png'))),'sprites')
