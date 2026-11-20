<?php

namespace Breefer\VersionChanger\Http;

use App\Models\Permission;
use App\Models\Server;
use Breefer\VersionChanger\Support\BaseController;
use Breefer\VersionChanger\Support\Plugin;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class VersionController extends BaseController
{
    private const FIELDS = 'id,type,projectVersionId,versionId,buildNumber,experimental,created';

    private function client(): PendingRequest
    {
        $request = Http::withUserAgent(Plugin::userAgent())
            ->baseUrl(rtrim((string) Plugin::setting('api_url', 'https://versions.mcjars.app'), '/'))
            ->acceptJson()
            ->timeout(15)
            ->retry(2, 200, throw: false);

        $key = (string) Plugin::setting('api_key', '');
        if ($key !== '') {
            $request = $request->withHeaders(['Authorization' => $key]);
        }

        return $request;
    }

    /** @return array<int, string> */
    private function allowedTypes(): array
    {
        $raw = strtoupper((string) Plugin::setting('types', ''));

        return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $raw) ?: [])));
    }

    private function typeAllowed(string $type): bool
    {
        $allowed = $this->allowedTypes();

        return ! $allowed || in_array($type, $allowed, true);
    }

    public function types(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServer($request, $server, Permission::ACTION_FILE_READ);

        $data = Cache::remember('breefer:vc:types', 600, function () {
            $response = $this->client()->get('/api/v1/types');

            return $response->successful() ? $response->json('types', []) : null;
        });

        if ($data === null) {
            Cache::forget('breefer:vc:types');

            return $this->fail('The version API is unreachable right now. Try again in a minute.', 502);
        }

        $types = [];
        $order = $this->allowedTypes();
        foreach ($data as $key => $type) {
            if (! $this->typeAllowed($key) || ! empty($type['deprecated']) && ! $order) {
                continue;
            }
            $types[] = [
                'key' => $key,
                'name' => $type['name'] ?? $key,
                'icon' => $type['icon'] ?? null,
                'description' => $type['description'] ?? '',
                'homepage' => $type['homepage'] ?? null,
                'experimental' => (bool) ($type['experimental'] ?? false),
                'deprecated' => (bool) ($type['deprecated'] ?? false),
                'builds' => (int) ($type['builds'] ?? 0),
            ];
        }

        if ($order) {
            usort($types, fn ($a, $b) => array_search($a['key'], $order, true) <=> array_search($b['key'], $order, true));
        }

        return new JsonResponse(['types' => $types]);
    }

    public function versions(Request $request, Server $server, string $type): JsonResponse
    {
        $this->authorizeServer($request, $server, Permission::ACTION_FILE_READ);
        $type = strtoupper($type);
        if (! preg_match('/^[A-Z0-9_]+$/', $type) || ! $this->typeAllowed($type)) {
            return $this->fail('Unknown server software.', 404);
        }

        $data = Cache::remember("breefer:vc:versions:{$type}", 600, function () use ($type) {
            $response = $this->client()->get("/api/v2/builds/{$type}", ['fields' => self::FIELDS]);

            return $response->successful() ? $response->json('builds', []) : null;
        });

        if ($data === null) {
            Cache::forget("breefer:vc:versions:{$type}");

            return $this->fail('Could not load versions for '.$type.'.', 502);
        }

        $versions = [];
        foreach ($data as $version => $info) {
            $versions[] = [
                'version' => (string) $version,
                'type' => $info['type'] ?? 'RELEASE',
                'supported' => (bool) ($info['supported'] ?? true),
                'java' => $info['java'] ?? null,
                'builds' => (int) ($info['builds'] ?? 0),
                'created' => $info['created'] ?? null,
                'latest' => $info['latest'] ?? null,
            ];
        }

        return new JsonResponse(['versions' => array_reverse($versions)]);
    }

    public function builds(Request $request, Server $server, string $type, string $version): JsonResponse
    {
        $this->authorizeServer($request, $server, Permission::ACTION_FILE_READ);
        $type = strtoupper($type);
        if (! preg_match('/^[A-Z0-9_]+$/', $type) || ! preg_match('/^[\w.\-+ ]+$/', $version) || ! $this->typeAllowed($type)) {
            return $this->fail('Unknown version.', 404);
        }

        $data = Cache::remember('breefer:vc:builds:'.$type.':'.md5($version), 300, function () use ($type, $version) {
            $response = $this->client()->get("/api/v2/builds/{$type}/".rawurlencode($version), ['fields' => self::FIELDS]);

            return $response->successful() ? $response->json('builds', []) : null;
        });

        if ($data === null) {
            Cache::forget('breefer:vc:builds:'.$type.':'.md5($version));

            return $this->fail('Could not load builds.', 502);
        }

        return new JsonResponse(['builds' => $data]);
    }

    public function installed(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServer($request, $server, Permission::ACTION_FILE_READ);

        $stored = json_decode((string) Plugin::setting('installed.'.$server->uuid, ''), true);

        return new JsonResponse(['installed' => is_array($stored) ? $stored : null]);
    }

    public function install(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServer($request, $server, [Permission::ACTION_FILE_CREATE, Permission::ACTION_FILE_DELETE, Permission::ACTION_CONTROL_STOP]);

        $data = $request->validate([
            'build' => 'required|integer|min:1',
            'delete_files' => 'required|boolean',
            'accept_eula' => 'sometimes|boolean',
        ]);

        @set_time_limit(600);

        $response = $this->client()->post('/api/v2/build?fields='.self::FIELDS.',installation', ['id' => (int) $data['build']]);
        if (! $response->successful() || ! $response->json('success', true)) {
            return $this->fail('That build could not be found.', 404);
        }

        $build = $response->json('build');
        $versionInfo = $response->json('version') ?? [];
        if (! is_array($build) || ! $this->typeAllowed(strtoupper((string) ($build['type'] ?? '')))) {
            return $this->fail('That server software is not allowed on this panel.', 403);
        }

        $files = $this->files($server);

        try {
            $this->power($server)->send('kill');
        } catch (\Throwable) {
            // already offline
        }

        try {
            if ($data['delete_files']) {
                $entries = $files->getDirectory('/');
                $names = array_values(array_filter(array_map(fn ($f) => $f['name'] ?? null, $entries)));
                if ($names) {
                    $files->deleteFiles('/', $names);
                }
            } else {
                // Old loader libraries conflict with new builds.
                $existing = array_map(fn ($f) => $f['name'] ?? '', $files->getDirectory('/'));
                $stale = array_values(array_intersect(['libraries', 'server.jar', '.fabric', '.quilt'], $existing));
                if ($stale) {
                    $files->deleteFiles('/', $stale);
                }
            }

            foreach ($build['installation'] ?? [] as $chunk) {
                foreach ($chunk as $step) {
                    switch ($step['type'] ?? '') {
                        case 'download':
                            $target = $this->safePath((string) $step['file']);
                            $files->pull((string) $step['url'], dirname($target), [
                                'filename' => basename($target),
                                'foreground' => true,
                            ]);
                            break;
                        case 'unzip':
                            $location = ($step['location'] ?? '.') === '.' ? '/' : $this->safePath((string) $step['location']);
                            $files->decompressFile($location, ltrim($this->safePath((string) $step['file']), '/'));
                            break;
                        case 'remove':
                            $path = $this->safePath((string) $step['location']);
                            try {
                                $files->deleteFiles(dirname($path), [basename($path)]);
                            } catch (\Throwable) {
                                // nothing to remove
                            }
                            break;
                    }
                }
            }

            if (! empty($data['accept_eula'])) {
                $files->putContent('/eula.txt', "# Accepted via Breefer Version Changer\neula=true\n");
            }
        } catch (\Throwable $exception) {
            return $this->fail('Installation failed: '.$exception->getMessage(), 502);
        }

        $this->pointJarVariable($server);
        $imageChanged = Plugin::bool('auto_java', true) ? $this->switchJavaImage($server, (int) ($versionInfo['java'] ?? 0)) : null;

        $record = [
            'id' => $build['id'] ?? null,
            'type' => $build['type'] ?? null,
            'version' => $build['versionId'] ?? $build['projectVersionId'] ?? null,
            'project_version' => $build['projectVersionId'] ?? null,
            'build' => $build['buildNumber'] ?? null,
            'java' => $versionInfo['java'] ?? null,
            'installed_at' => now()->toIso8601String(),
        ];
        Plugin::set('installed.'.$server->uuid, json_encode($record));

        $this->activity('server:breefer.version.install', $record + ['delete_files' => (bool) $data['delete_files']]);

        return $this->ok(['installed' => $record, 'image' => $imageChanged]);
    }

    private function pointJarVariable(Server $server): void
    {
        try {
            $server->loadMissing('egg.variables');
            $variable = $server->egg->variables->firstWhere('env_variable', 'SERVER_JARFILE');
            if ($variable) {
                \App\Models\ServerVariable::query()->updateOrCreate(
                    ['server_id' => $server->id, 'variable_id' => $variable->id],
                    ['variable_value' => 'server.jar']
                );
            }
        } catch (\Throwable) {
            // egg without SERVER_JARFILE
        }
    }

    private function switchJavaImage(Server $server, int $java): ?string
    {
        if ($java <= 0) {
            return null;
        }
        $images = (array) ($server->egg->docker_images ?? []);
        $best = null;
        foreach ($images as $image) {
            $tag = (string) (explode(':', (string) $image)[1] ?? '');
            if ((int) preg_replace('/\D/', '', $tag) === $java) {
                $best = $image;
                break;
            }
        }
        if ($best && $best !== $server->image) {
            $server->forceFill(['image' => $best])->save();

            return $best;
        }

        return null;
    }
}
