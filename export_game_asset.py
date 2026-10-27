"""Export a game-ready GLB from the lighthouse .blend.

Run (the .blend file is kept outside this repo):
    blender -b path\\to\\lighthouse.blend --python export_game_asset.py
"""

import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(HERE, "lighthouse.glb")

if not bpy.data.filepath:
    raise RuntimeError("Open lighthouse.blend first: blender -b path\\to\\lighthouse.blend --python export_game_asset.py")

bpy.ops.object.select_all(action="DESELECT")

selected = []
for collection_name in ("Island", "Lighthouse"):
    collection = bpy.data.collections.get(collection_name)
    if collection is None:
        raise RuntimeError(f"Missing collection: {collection_name}")
    for obj in collection.all_objects:
        if obj.type == "MESH":
            obj.select_set(True)
            selected.append(obj)

# The shoreline foam lives in Environment but is part of the island's look.
foam = bpy.data.objects.get("Foam")
if foam is not None and foam.type == "MESH":
    foam.select_set(True)
    selected.append(foam)

if not selected:
    raise RuntimeError("No meshes selected for export")

bpy.context.view_layer.objects.active = selected[0]
bpy.ops.export_scene.gltf(
    filepath=OUTPUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_extras=False,
)

print(f"[export] wrote {OUTPUT} ({os.path.getsize(OUTPUT)} bytes), {len(selected)} meshes")
