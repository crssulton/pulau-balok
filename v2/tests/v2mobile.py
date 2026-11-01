import asyncio, sys
from playwright.async_api import async_playwright
S = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8766'


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 700}, has_touch=True, is_mobile=True, device_scale_factor=1)
        pg = await ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:{PORT}/v2/'); await pg.wait_for_selector('#names button', timeout=60000)
        await pg.fill('#newName', 'Tablet'); await pg.tap('#genderBtn'); await pg.tap('#createBtn'); await pg.wait_for_timeout(6000)
        await pg.screenshot(path=f'{S}/m-play.png')
        touch = await pg.evaluate("document.body.classList.contains('touch')")
        # joystick: geser ke atas
        box = await pg.locator('#stick').bounding_box()
        cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        z0 = await pg.evaluate("__pb2.ctl.pos.z")
        await pg.evaluate(f"""(()=>{{const el=document.getElementById('stick'); const ev=(t,x,y)=>el.dispatchEvent(new PointerEvent(t,{{pointerId:7,clientX:x,clientY:y,bubbles:true,pointerType:'touch'}})); ev('pointerdown',{cx},{cy}); ev('pointermove',{cx},{cy - 60}); window.__up=()=>ev('pointerup',{cx},{cy - 60});}})()""")
        await pg.wait_for_timeout(4000)
        await pg.evaluate("window.__up()")
        z1 = await pg.evaluate("__pb2.ctl.pos.z")
        await pg.tap('#buildBtn'); await pg.wait_for_timeout(2500)
        await pg.mouse.click(512, 300)  # fallback klik
        await pg.wait_for_timeout(800)
        n = await pg.evaluate("__pb2.builder.count()")
        await pg.screenshot(path=f'{S}/m-build.png')
        print('touch', touch, 'moved', round(z1 - z0, 2), 'blocks', n)
        print('\n'.join(logs[-15:]))
        await b.close()

asyncio.run(main())
