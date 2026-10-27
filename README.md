# Lighthouse Island — walkabout

A first-person walkaround of the low-poly lighthouse island, running in the browser with Three.js. No build step, no package install, no internet connection required.

Play online: https://sparedcolt166.github.io/lighthouse-island/

Working on this with an AI agent? Read [AGENTS.md](AGENTS.md) first.

## Run it

Double-click **`start.cmd`**.

That starts a tiny local web server and opens:

```
http://127.0.0.1:8000/
```

If the browser doesn't open automatically, visit that address yourself. Keep the console window open while you play; close it or press `Ctrl+C` to stop the server.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrow keys | Walk |
| Mouse | Look around |
| `Shift` | Run |
| `Space` | Jump |
| `E` | Open or close the lighthouse door |
| `R` | Return to the shore |
| `Esc` | Release the mouse / pause |

Click **Step onto the island** to capture the mouse. You walk on the actual island mesh, so you can climb the path, step up onto the lighthouse plinth, and wander the rocky shore. The surrounding water is the edge of the playable area.

The lighthouse door is real. Stand close and press `E` (or click **Open the door** when it appears), then walk up the steps and through the doorway. Inside is a small round room with a table, a lamp, a rug, and a ladder. Press `E` again to close the door behind you.

The island and lighthouse are scaled up 2.5× from the Blender export, so the 1.9 m door and the room read at human size while the tower still looms over you.

If your browser blocks mouse capture (some embedded browsers do), the walkabout automatically switches to click-and-drag look, and the on-screen hint changes to **Drag look**.

## What's here

- `index.html` — page shell, intro overlay, HUD
- `style.css` — visual styling
- `main.js` — Three.js scene, loading, movement, collision, door, interior, animation
- `lighthouse.glb` — the game-ready export (island, lighthouse, foam; 94 meshes)
- `export_game_asset.py` — regenerates `lighthouse.glb` from `lighthouse.blend` (kept outside this repo)
- `vendor/` — local Three.js r170 modules
- `server.mjs` — small static file server
- `start.cmd` — double-click launcher

## Regenerate the model

The Blender source (`lighthouse.blend`) is kept outside this repo. From this folder, pass its path:

```powershell
blender -b path\to\lighthouse.blend --python export_game_asset.py
```

## Use it in an engine

`lighthouse.glb` is a standard glTF binary. If you later want a bigger game, import that file into Godot 4, Unity, Unreal, or any engine that reads glTF. The island, lighthouse, and foam are already separated from the sky, water, camera, and lights.

## Notes

The Blender scene itself can also be explored without exporting: open `lighthouse.blend`, then **View → Navigation → Walk Navigation** (or `Shift+\``). WASD moves, the mouse looks, `Q`/`E` go down/up, `Shift` moves faster; click to confirm, `Esc` or right-click to cancel.
