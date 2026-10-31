import asyncio, sys, time
from playwright.async_api import async_playwright
S = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8766'


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        t0 = time.time()
        await pg.goto(f'http://localhost:{PORT}/v2/')
        await pg.wait_for_selector('#names button', timeout=60000)
        print('load s', round(time.time() - t0, 1))
        await pg.click('#names button'); await pg.wait_for_timeout(5000)
        await pg.screenshot(path=f'{S}/w-desa.png')
        info = await pg.evaluate("(()=>{const r=__pb2.R.renderer.info;return {calls:r.render.calls,tris:r.render.triangles, trees: window.__pbTrees, count: __pb2.builder.count(), summit: __pb2.world.summit}})()")
        print('INFO', info)
        for sid in ['gunung', 'hutan', 'gurun', 'danau', 'bunga', 'dermaga']:
            await pg.evaluate(f"(()=>{{const s=__pb2.world.SPOTS.find(s=>s.id==='{sid}'); __pb2.teleport(s.x,s.z); __pb2.cam.target.set(s.x, __pb2.ctl.pos.y+1.7, s.z); __pb2.cam.wantDist=16; __pb2.cam.pitch=0.35;}})()")
            await pg.wait_for_timeout(5000)
            y = await pg.evaluate("__pb2.ctl.pos.y")
            await pg.screenshot(path=f'{S}/w-{sid}.png')
            print(sid, 'y', round(y, 1))
        print('\n'.join(logs[-20:]))
        await b.close()

asyncio.run(main())
