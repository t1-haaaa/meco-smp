import struct, zlib, math

def _read(off, fmt, size, buf): return struct.unpack_from(fmt, buf, off)[0], off + size
def _parse_payload(typ, buf, off):
    if typ == 1: v, off = _read(off, '>b', 1, buf); return v, off
    if typ == 2: v, off = _read(off, '>h', 2, buf); return v, off
    if typ == 3: v, off = _read(off, '>i', 4, buf); return v, off
    if typ == 4: v, off = _read(off, '>q', 8, buf); return v, off
    if typ == 5: v, off = _read(off, '>f', 4, buf); return v, off
    if typ == 6: v, off = _read(off, '>d', 8, buf); return v, off
    if typ == 7: n, off = _read(off, '>i', 4, buf); return list(buf[off:off + n]), off + n
    if typ == 8: n, off = _read(off, '>H', 2, buf); return buf[off:off + n].decode('utf-8'), off + n
    if typ == 9:
        et = buf[off]; off += 1
        n, off = _read(off, '>i', 4, buf); items = []
        for _ in range(n):
            if et == 10: v, off = _parse_children(buf, off)
            else: v, off = _parse_payload(et, buf, off)
            items.append(v)
        return items, off
    if typ == 10: return _parse_children(buf, off)
    if typ == 11:
        n, off = _read(off, '>i', 4, buf); return list(struct.unpack_from('>%di' % n, buf, off)), off + n * 4
    if typ == 12:
        n, off = _read(off, '>i', 4, buf); return list(struct.unpack_from('>%dq' % n, buf, off)), off + n * 8
    raise ValueError('unknown %d' % typ)
def _parse_named(buf, off):
    typ = buf[off]; off += 1
    if typ == 0: return None
    nlen = struct.unpack_from('>H', buf, off)[0]; off += 2
    name = buf[off:off + nlen].decode('utf-8'); off += nlen
    val, off = _parse_payload(typ, buf, off)
    return name, val, off
def _parse_children(buf, off):
    d = {}
    while True:
        if buf[off] == 0:
            off += 1; break
        name, val, off = _parse_named(buf, off)
        d[name] = val
    return d, off
def parse_nbt(buf):
    nlen = struct.unpack_from('>H', buf, 1)[0]
    return _parse_children(buf, 3 + nlen)[0]
def get_chunk_raw(path, cx, cz):
    with open(path, 'rb') as f:
        f.seek(4 * ((cx % 32) + (cz % 32) * 32))
        loc = struct.unpack('>I', f.read(4))[0]
        off = (loc >> 8) * 4096; sec = loc & 0xFF
        if off == 0 or sec == 0: return None
        f.seek(off)
        ln = struct.unpack('>I', f.read(4))[0]; comp = f.read(1)[0]
        data = f.read(ln - 1)
        if comp == 2: return zlib.decompress(data)
        if comp == 1: return zlib.decompress(data, 16 + zlib.MAX_WBITS)
        return data

def load_chunk(path, cx, cz):
    raw = get_chunk_raw(path, cx, cz)
    if raw is None: return None
    root = parse_nbt(raw)
    secs = {}
    for s in root.get('sections', []):
        if not isinstance(s, dict): continue
        sy = s.get('Y')
        if sy is None: continue
        bs = s.get('block_states', {}) or {}
        palette = bs.get('palette', []) or []
        names = [p.get('Name', '?') for p in palette] if isinstance(palette, list) else []
        data = bs.get('data', []) or []
        secs[sy] = (names, data)
    return secs

def block_at(secs, y, bx, bz):
    ent = secs.get(y // 16)
    if ent is None: return 'air'
    names, data = ent
    if not data:
        return names[0] if names else 'air'
    bits = max(4, math.ceil(math.log2(len(names))))
    mask = (1 << bits) - 1
    idx = bz * 256 + (y % 16) * 16 + bx
    start = idx * bits; li = start // 64; o = start % 64
    if li + 1 < len(data): v = (data[li] >> o) | (data[li + 1] << (64 - o))
    else: v = data[li] >> o
    i = v & mask
    if i >= len(names): return '?'
    return names[i]

# Focus window around the build (world x -20..260, z -20..260)
regions = [('arena/region/r.0.0.mca', 0, 0), ('arena/region/r.-1.0.mca', -1, 0), ('arena/region/r.0.-1.mca', 0, -1), ('arena/region/r.-1.-1.mca', -1, -1)]
cache = {}
for path, rx, rz in regions:
    with open(path, 'rb') as f:
        tbl = f.read(4096)
    for lcz in range(32):
        for lcx in range(32):
            loc = struct.unpack_from('>I', tbl, 4 * (lcx + lcz * 32))[0]
            if (loc >> 8) == 0: continue
            try:
                cache[(rx * 32 + lcx, rz * 32 + lcz)] = load_chunk(path, rx * 32 + lcx, rz * 32 + lcz)
            except Exception:
                pass

def sample(wx, wz, y):
    ent = cache.get((wx // 16, wz // 16))
    if ent is None: return 'air'
    return block_at(ent, y, wx % 16, wz % 16)

def char(b):
    if 'air' in b or 'cave' in b or 'void' in b: return '.'
    if 'water' in b: return '~'
    if 'sand' in b: return 's'
    if 'grass' in b or 'dirt' in b or 'snow' in b or 'moss' in b: return ','
    if 'wool' in b: return 'W'
    if 'bed' in b: return 'B'
    if 'log' in b or 'planks' in b or 'wood' in b: return '#'
    if 'glass' in b: return 'g'
    if 'stone' in b or 'cobble' in b or 'brick' in b or 'concrete' in b or 'quartz' in b or 'terracotta' in b or 'blackstone' in b or 'deepslate' in b or 'purpur' in b or 'diorite' in b or 'granite' in b or 'andesite' in b or 'sandstone' in b or 'prismarine' in b or 'basalt' in b or 'nether' in b or 'smooth' in b or 'stone_brick' in b or 'mud' in b or 'packed' in b or 'obsidian' in b or 'crying' in b or 'gold' in b or 'iron' in b or 'diamond' in b or 'emerald' in b or 'netherite' in b or 'copper' in b or 'bone' in b or 'lime' in b: return 'M'
    if 'door' in b or 'fence' in b or 'wall' in b or 'bars' in b or 'ladder' in b or 'stair' in b or 'slab' in b or 'torch' in b or 'lantern' in b or 'button' in b or 'lever' in b or 'plate' in b or 'gate' in b: return ':'
    return '+'

x0, x1, z0, z1, step = -20, 260, -20, 260, 2
for yl in (62, 64, 66, 70, 75, 80):
    print("\n===== DETAIL y=%d step=%d x%d..%d z%d..%d =====" % (yl, step, x0, x1, z0, z1))
    for wz in range(z0, z1, step):
        print("%5d | %s" % (wz, ''.join(char(sample(wx, wz, yl)) for wx in range(x0, x1, step))))