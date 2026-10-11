# Lighting Studio

Static page for experimenting with photoshoot lighting on a 3D head. No build step.

## Run

ES modules and the model need HTTP, so serve the folder:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Use

- Pick a preset, or add spot, point and softbox lights (max 6).
- Select a light to change its type, colour, intensity, orbit position (azimuth, elevation, distance) and aim (pan, tilt).
- Drag a light marker to orbit it; drag the background to move the camera.
