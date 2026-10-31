import asyncio, sys
from playwright.async_api import async_playwright
S = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8766'


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:{PORT}/v2/'); await pg.wait_for_timeout(4000)
        await pg.click('#names button'); await pg.wait_for_timeout(6000)
        n0 = await pg.evaluate("__pb2.builder.count()")
        await pg.evaluate("__pb2.teleport(-30,-430); __pb2.ctl.facing=0; __pb2.cam.yaw=Math.PI")
        await pg.wait_for_timeout(2500)
        await pg.keyboard.press('b'); await pg.wait_for_timeout(2500)
        for (x, y) in [(640, 330), (640, 330), (700, 330), (580, 330)]:
            await pg.mouse.move(x, y); await pg.wait_for_timeout(300); await pg.mouse.click(x, y); await pg.wait_for_timeout(600)
        n1 = await pg.evaluate("__pb2.builder.count()")
        await pg.keyboard.press('k'); await pg.keyboard.press('k')
        await pg.mouse.move(640, 250); await pg.wait_for_timeout(400); await pg.mouse.click(640, 250); await pg.wait_for_timeout(800)
        n2 = await pg.evaluate("__pb2.builder.count()")
        await pg.screenshot(path=f'{S}/v2-free1.png')
        await pg.keyboard.press('t'); await pg.keyboard.down(' '); await pg.wait_for_timeout(5000); await pg.keyboard.up(' ')
        fy = await pg.evaluate("__pb2.ctl.pos.y")
        await pg.screenshot(path=f'{S}/v2-fly.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(5000)
        gy = await pg.evaluate("__pb2.ctl.pos.y")
        await pg.click('#homeBtn'); await pg.wait_for_timeout(1000)
        await pg.evaluate("__pb2.cam.wantDist=24; __pb2.cam.pitch=0.55")
        await pg.wait_for_timeout(4000)
        await pg.screenshot(path=f'{S}/v2-home.png')
        await pg.reload(); await pg.wait_for_timeout(4000); await pg.click('#names button'); await pg.wait_for_timeout(6000)
        n3 = await pg.evaluate("__pb2.builder.count()")
        print('COUNT start', n0, 'clicks', n1, 'brush', n2, 'reload', n3, 'flyY', round(fy, 2), 'afterLand', round(gy, 2))
        print('\n'.join(logs[-20:]))
        await b.close()

asyncio.run(main())
