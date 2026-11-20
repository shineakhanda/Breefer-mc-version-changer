<?php

namespace Breefer\VersionChanger;

use Breefer\VersionChanger\Support\RouteScope;
use Illuminate\Support\Facades\Cache;

final class AdminFields
{
    public static function intro(): string
    {
        return 'Builds are provided by the free <a style="color:#93c5fd" href="https://mcjars.app" target="_blank" rel="noopener">MCJars</a> API. '
            .'Users pick a server software, version and build; the jar (and any loader libraries) are downloaded straight onto the server by the agent.';
    }

    /** @return array<int, array<string, mixed>> */
    public static function fields(): array
    {
        return [
            ['key' => 'types', 'label' => 'Allowed server software', 'type' => 'text', 'default' => '', 'section' => 'Software',
                'help' => 'Comma-separated, in display order, e.g. <code>PAPER, PURPUR, FABRIC, FORGE, NEOFORGE, VANILLA, VELOCITY</code>. Empty = all non-deprecated types.'],
            ['key' => 'auto_java', 'label' => 'Automatically switch to the matching Java docker image', 'type' => 'toggle', 'default' => '1', 'section' => 'Software',
                'help' => 'Uses the egg\'s docker images whose tag contains the Java version (e.g. <code>java_21</code>).'],
            ['key' => 'api_url', 'label' => 'MCJars API URL', 'type' => 'text', 'default' => 'https://versions.mcjars.app', 'section' => 'API'],
            ['key' => 'api_key', 'label' => 'MCJars organization key (optional)', 'type' => 'password', 'default' => '', 'section' => 'API'],
            ...RouteScope::fields(),
        ];
    }

    public static function saved(): void
    {
        Cache::forget('breefer:vc:types');
        RouteScope::saved();
    }
}
