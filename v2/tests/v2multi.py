import asyncio, sys, json
import websockets
from playwright.async_api import async_playwright
S = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8766'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']


async def main():
    # pemain kedua: klien WebSocket (seperti tablet kedua di WiFi rumah)
    ws = await websockets.connect(f'ws://localhost:{PORT}/ws')
    await ws.send(json.dumps({'t': 'login', 'name': 'Tablet', 'create': True, 'v2': True, 'data': {'avatar': {}, 'updated': 1}}))
    await ws.send(json.dumps({'t': 'buildHello'}))
    got = {'plots': None, 'buildPlot': None, 'join': None}

    async def reader():
        async for raw in ws:
            m = json.loads(raw)
            if m['t'] == 'buildWorld': got['plots'] = len(m['plots'])
            if m['t'] == 'buildPlot': got['buildPlot'] = (m['plot']['key'], len(m['plot']['blocks']), m['plot'].get('v'))
            if m['t'] == 'join': got['join'] = (m['p']['name'], m['p'].get('v2'))
    task = asyncio.create_task(reader())
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        pg = await b.new_page(viewport={'width': 800, 'height': 500})
        errs = []
        pg.on('pageerror', lambda e: errs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:{PORT}/v2/'); await pg.wait_for_selector('#names button', timeout=60000)
        await pg.fill('#newName', 'Uji'); await pg.click('#createBtn'); await pg.wait_for_timeout(5000)
        sees_tablet = await pg.evaluate("[...document.querySelectorAll('canvas')].length > 0")
        await pg.evaluate("""(()=>{const B=__pb2.builder,V=__pb2.voxels; for (let k=0;k<3;k++){ const x=-40+k, z=-440; if (!V.has(x,0,z)) { V.add(x,0,z,0,4,0,B.owner); B.push({k:'add',x,y:0,z,t:0,c:4,r:0}); } } B._count=null; })()""")
        await pg.wait_for_timeout(4000)
        print('tablet menerima:', got, '| errors', errs[-3:], sees_tablet)
        await b.close()
    task.cancel(); await ws.close()

asyncio.run(main())
