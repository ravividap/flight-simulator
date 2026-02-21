# Flight Simulator

A basic flight simulator MVP built with [Three.js](https://threejs.org/).

![Flight Simulator Screenshot](https://github.com/user-attachments/assets/05fc9455-a624-472b-92dd-44501d42c251)

## Features

- **3D Airplane** – propeller-driven aircraft with fuselage, wings, tail, cockpit glass, landing gear and wingtip lights
- **Procedural Terrain** – rolling hills with vertex-color shading (grass → rock → snow), a flat runway, trees and volumetric clouds
- **Gradient Sky** – horizon-to-zenith sky shader with exponential fog
- **Flight Physics** – thrust, lift (stall below 20 m/s), aerodynamic drag, gravity, ground friction and roll/pitch auto-level
- **HUD** – altitude, airspeed (km/h), heading, throttle %, vertical-speed indicator, pitch/roll/G-force readout
- **Attitude Indicator** – real-time artificial horizon instrument
- **Stall Warning** – flashing overlay when below stall speed in the air

## Controls

| Key | Action |
|-----|--------|
| `W` / `S` | Pitch up / down |
| `A` / `D` | Roll left / right |
| `Q` / `E` | Rudder left / right |
| `↑` / `↓` | Increase / decrease throttle |
| `Space` | Reset aircraft to runway |

## Getting Started

```bash
npm install
npm run dev        # start dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build
```

## Requirements

- Node.js 18+
