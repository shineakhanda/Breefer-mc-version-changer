# Breefer Version Changer

Switch a Minecraft server between Paper, Purpur, Folia, Fabric, Quilt, Forge, NeoForge, Vanilla, Velocity, BungeeCord and more. Pick software → version → build; the agent downloads the jar/libraries directly, optionally accepts the EULA, wipes files, points `SERVER_JARFILE` to `server.jar` and switches to the matching Java image.

## Download

The ready-to-install package is [`release/breefer-version-changer-v1.1.0.rext`](release/breefer-version-changer-v1.1.0.rext) (also attached to the GitHub release). Upload it under **Admin → Extensions** in Reviactyl.

## Repository layout

```
extension.json      manifest (routes, slots, boot hook, frontend entries)
backend/            PHP: routes, controllers, boot hook, admin settings
frontend/src/       TypeScript/React source
frontend/dist/      compiled modules shipped in the .rext
release/            installable .rext package
```

## Requirements

- Reviactyl panel with the extension API `RCYL_v26` (tested against the `canary` target).
- Built and packaged with the official Reviactyl extension compiler.

## Install

**Admin area:** upload `breefer-version-changer.rext` under **Admin → Extensions** and enable it.

**Command line:** copy `breefer-version-changer.rext` into your Reviactyl root (e.g. `/var/www/reviactyl`), then:

```bash
cd /var/www/reviactyl
php artisan extensions:install breefer-version-changer --enable
php artisan optimize:clear
```

Older builds use the singular form shown in the example extension: `php artisan extension:install breefer-version-changer` then `php artisan extension:enable breefer-version-changer`.

## Usage

- Page: **Versions** (server sidebar)
- Permissions: `file.create`, `file.delete`, `control.stop`

## Configuration

Admin area → sidebar group **Breefer** → **Version Changer** (root admins only). Fallback URL: `/admin/extensions/breefer-version-changer`.

Options: Allowed software list and order, auto Java image switching, MCJars API URL / organisation key, page visibility.

## Data and external services

- Data: Remembers the last installed build per server in the panel `settings` table.
- External services: [MCJars](https://mcjars.app) API for build metadata; the agent downloads builds from the official sources MCJars points to.

## Notes

- Auto Java switching uses egg docker images whose tag contains the Java version (e.g. `java_21`).

## Development

```bash
php artisan d:extensions:dev breefer-version-changer --enable
php artisan d:extensions:watch breefer-version-changer
```

## Author

Shine Akhanda — part of the **Breefer** extension collection.

## License

MIT — see `LICENSE`.
