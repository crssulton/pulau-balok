import asyncio, sys
from playwright.async_api import async_playwright
S = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8766'


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append('ERR ' + str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(f'http://localhost:{PORT}/'); await pg.wait_for_timeout(6000)
        await pg.evaluate("window.__pb.doLogin('Lama', true)"); await pg.wait_for_timeout(4000)
        await pg.click('#playBtn', timeout=5000); await pg.wait_for_timeout(6000)
        await pg.evaluate("window.__pb.teleport(0,-400)"); await pg.wait_for_timeout(6000)
        ok = await pg.evaluate("!!window.__pb && window.__pb.player.pos.z < -300")
        await pg.screenshot(path=f'{S}/v1-kebun.png')
        print('v1 ok', ok, 'errors', errs[-8:])
        await b.close()

asyncio.run(main())
