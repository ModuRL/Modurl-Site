# ModuRL Site

Source for [modurl.dev](https://modurl.dev), the website for [ModuRL](https://github.com/ModuRL/ModuRL), a type-safe, modular reinforcement-learning library for Rust built on [Burn](https://burn.dev).

The guide lives at [docs.modurl.dev](https://docs.modurl.dev) and is built from the main ModuRL repository.

## Running locally

The site is plain HTML, CSS and JavaScript with no build step.

```sh
git clone https://github.com/ModuRL/Modurl-Site.git
cd Modurl-Site
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Deployment

GitHub Pages serves the `main` branch at modurl.dev. Changes go live a minute or two after they are merged.
