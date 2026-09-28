"""Export native tap layers for the Canvas playback renderer.
Usage: python3 scripts/extract-playback-effects.py /path/to/effect_asset/live/tap_effect/0 [output-json] [base-json]
For the simplified preset, export tap_effect/1 to playbackEffectsSimple.json
with playbackEffects.json as base-json to retain only native property differences.
Requires UnityPy and Pillow. Output curves retain Unity's weighted keyframes.
"""
import json
import hashlib
import math
import sys
from pathlib import Path
import UnityPy

UnityPy.config.FALLBACK_UNITY_VERSION = '2022.3.21f1'
env = UnityPy.load(sys.argv[1])
objects = {o.path_id: o for o in env.objects}
data = {i: o.read_typetree() for i, o in objects.items() if o.type.name in ('GameObject', 'Transform', 'ParticleSystem', 'ParticleSystemRenderer', 'Material')}
transforms = {a['m_GameObject']['m_PathID']: a for i, a in data.items() if objects[i].type.name == 'Transform'}
renderers = {a['m_GameObject']['m_PathID']: a for i, a in data.items() if objects[i].type.name == 'ParticleSystemRenderer'}
root = Path(__file__).resolve().parents[1]
out = root / 'public/playback/effects'
out.mkdir(parents=True, exist_ok=True)

def chain(go):
    t = transforms[go]
    parent = t['m_Father']['m_PathID']
    return (chain(data[parent]['m_GameObject']['m_PathID']) if parent else []) + [(data[go]['m_Name'], t)]

def curve(c):
    return {'mode': c['minMaxState'], 'value': c['scalar'], 'min': c['minScalar'],
            'keys': c['maxCurve']['m_Curve'], 'minKeys': c['minCurve']['m_Curve']}

def gradient(g):
    return {'rgb': [[g[f'ctime{i}']/65535, *[g[f'key{i}'][k] for k in 'rgb']] for i in range(g['m_NumColorKeys'])],
            'alpha': [[g[f'atime{i}']/65535, g[f'key{i}']['a']] for i in range(g['m_NumAlphaKeys'])]}

def motion(module):
    return {'world': module['inWorldSpace'],
            'axes': [curve(module[k]) for k in 'xyz']} if module['enabled'] else None

result = {}
atlases = {}
for i, p in data.items():
    if objects[i].type.name != 'ParticleSystem':
        continue
    go = p['m_GameObject']['m_PathID']
    lineage = chain(go)
    name = lineage[0][0]
    if name not in {f'fx_note_{critical}{kind}_aura' for critical in ('', 'critical_') for kind in ('normal', 'flick', 'trace', 'long', 'long_hold_via', 'long_hold')} | {'fx_note_flick_flash', 'fx_note_critical_flick_flash', 'fx_note_hold_aura', 'fx_note_critical_long_hold_gen_aura'} | {f'fx_note_{critical}{kind}_gen' for critical in ('', 'critical_') for kind in ('normal', 'flick', 'long', 'long_hold')} | {f'fx_lane_{kind}' for kind in ('default', 'critical', 'flick', 'critical_flick')}:
        continue
    initial = p['InitialModule']
    renderer = renderers[go]
    if not renderer['m_Enabled'] or any(not data[t['m_GameObject']['m_PathID']]['m_IsActive'] for _, t in lineage):
        continue
    if not renderer['m_Materials'] or not renderer['m_Materials'][0]['m_PathID']:
        continue
    material = data[renderer['m_Materials'][0]['m_PathID']]
    texture = dict(material['m_SavedProperties']['m_TexEnvs'])['_MainTex']['m_Texture']['m_PathID']
    if texture not in atlases:
        atlas = objects[texture].read().image
        filename = 'atlas-' + hashlib.sha256(atlas.tobytes()).hexdigest()[:16] + '.png'
        atlas.save(out / filename)
        atlases[texture] = filename
    filename = atlases[texture]
    uv = p['UVModule']
    cols, rows = uv['tilesX'], uv['tilesY']
    rotation = [0, 0, 0, 1]
    scale = {k: 1 for k in 'xyz'}
    position = {k: 0 for k in 'xyz'}
    def rotate(q, v):
        x, y, z, w = q
        u = [x, y, z]
        cross = lambda a, b: [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
        uv = cross(u, v)
        uuv = cross(u, uv)
        return [v[j]+2*(w*uv[j]+uuv[j]) for j in range(3)]
    def multiply(a, b):
        x,y,z,w=a; X,Y,Z,W=b
        return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]
    for _, transform in lineage:
        offset = rotate(rotation, [transform['m_LocalPosition'][k]*scale[k] for k in 'xyz'])
        for j, k in enumerate('xyz'):
            position[k] += offset[j]
            scale[k] *= transform['m_LocalScale'][k]
        rotation = multiply(rotation, [transform['m_LocalRotation'][k] for k in 'xyzw'])
    shape = p['ShapeModule']
    # Local scaling deliberately excludes parents, as ParticleSystemScalingMode
    # specifies. Hierarchy applies ancestors; Shape scales emission only.
    particle_scale = scale if p['scalingMode'] == 0 else lineage[-1][1]['m_LocalScale'] if p['scalingMode'] == 1 else dict.fromkeys('xyz', 1)
    shape_scale = scale if p['scalingMode'] == 2 else particle_scale
    size = p['SizeModule']
    color = p['ColorModule']
    effect_key = name.removeprefix('fx_note_').removesuffix('_aura') if name.startswith('fx_note_') else name.removeprefix('fx_')
    effect_key = {'fx_note_hold_aura':'hold_sustain_aura', 'fx_note_critical_long_hold_gen_aura':'critical_hold_sustain_aura'}.get(name, effect_key)
    result.setdefault(effect_key, []).append({
        'source': '/'.join(n for n, _ in lineage), 'image': filename,
        'delay': p['startDelay']['scalar'], 'life': initial['startLifetime']['scalar'],
        'duration': p['lengthInSec'],
        'looping': p['looping'], 'simulationSpace': p['moveWithTransform'], 'scalingMode': p['scalingMode'],
        'rateOverTime': curve(p['EmissionModule']['rateOverTime']) if p['EmissionModule']['enabled'] else None,
        'bursts': [{**{k: b[k] for k in ('time', 'cycleCount', 'repeatInterval', 'probability')}, 'count': curve(b['countCurve'])} for b in p['EmissionModule']['m_Bursts']] if p['EmissionModule']['enabled'] else [],
        'maxParticles': initial['maxNumParticles'],
        'lifetime': curve(initial['startLifetime']), 'speed': curve(initial['startSpeed']),
        'startSizeX': curve(initial['startSize']),
        'startSizeY': curve(initial['startSizeY'] if initial['size3D'] else initial['startSize']),
        'scale': [particle_scale[k] for k in 'xyz'],
        'shapeScale': [shape_scale[k] for k in 'xyz'],
        'shape': {k: shape[k] for k in ('enabled', 'type', 'angle', 'length', 'radiusThickness', 'radius', 'arc', 'm_Position', 'm_Rotation', 'm_Scale', 'randomDirectionAmount', 'sphericalDirectionAmount', 'randomPositionAmount')},
        'width': initial['startSize']['scalar'] * particle_scale['x'],
        'height': (initial['startSizeY']['scalar'] if initial['size3D'] else initial['startSize']['scalar']) * particle_scale['y'],
        'position': position, 'rotation': curve(initial['startRotation']),
        'velocity': motion(p['VelocityModule']),
        'force': motion(p['ForceModule']),
        'angularVelocity': curve(p['RotationModule']['curve']) if p['RotationModule']['enabled'] else None,
        'gravity': curve(initial['gravityModifier']),
        'limitVelocity': {'dampen': p['ClampVelocityModule']['dampen'], 'limit': curve(p['ClampVelocityModule']['magnitude'])} if p['ClampVelocityModule']['enabled'] else None,
        'color': initial['startColor']['maxColor'],
        'randomColor': gradient(initial['startColor']['maxGradient']) if initial['startColor']['minMaxState'] == 4 else None,
        'sizeX': curve(size['curve']) if size['enabled'] else None,
        'sizeY': curve(size['y'] if size['separateAxes'] else size['curve']) if size['enabled'] else None,
        'gradient': gradient(color['gradient']['maxGradient']) if color['enabled'] else None,
        'uv': {'columns': cols if uv['enabled'] else 1, 'rows': rows if uv['enabled'] else 1, 'start': curve(uv['startFrame']), 'frame': curve(uv['frameOverTime']), 'cycles': uv['cycles']} if uv['enabled'] else None,
        'renderMode': renderer['m_RenderMode'],
        'pivot': renderer['m_Pivot'],
        'basisX': rotate(rotation, [1, 0, 0]),
        'basisY': rotate(rotation, [0, 1, 0]),
        'basisZ': rotate(rotation, [0, 0, 1]),
        'alignment': renderer['m_RenderAlignment'],
        'maxSize': renderer['m_MaxParticleSize'],
        'lengthScale': renderer['m_LengthScale'], 'velocityScale': renderer['m_VelocityScale'],
        'sortMode': renderer['m_SortMode'],
        'order': renderer['m_SortingOrder'],
        'additive': p['CustomDataModule']['vector0_0']['scalar'] > .5,

    })
for layers in result.values():
    layers.sort(key=lambda layer: layer['order'])
def json_safe(value):
    # Unity uses infinite tangents for stepped curves. Keep that signal without
    # producing Infinity tokens, which are invalid in JSON.
    if isinstance(value, float) and not math.isfinite(value):
        return 'Infinity' if value > 0 else '-Infinity'
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    return value
layer_count = sum(map(len, result.values()))
if len(sys.argv)>3:
    baseline = json.loads((root / 'src/chart-viewer' / sys.argv[3]).read_text())
    old = {layer['source']: layer for layers in baseline.values() for layer in layers}
    current = {layer['source']: json_safe(layer) for layers in result.values() for layer in layers}
    if old.keys() != current.keys():
        raise ValueError('Preset layer sets differ; cannot encode a property-only patch')
    result = {'source': 'effect_asset/live/tap_effect/1', 'overrides': {
        name: {key: value for key, value in layer.items() if value != old[name].get(key)}
        for name, layer in current.items() if layer != old[name]}}
(root / 'src/chart-viewer' / (sys.argv[2] if len(sys.argv)>2 else 'playbackEffects.json')).write_text(json.dumps(json_safe(result), ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n')
print('Exported', layer_count, 'native layers')
