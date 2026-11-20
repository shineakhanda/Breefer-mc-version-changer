<?php

use App\Http\Middleware\Activity\ServerSubject;
use App\Http\Middleware\Api\Client\Server\AuthenticateServerAccess;
use App\Http\Middleware\Api\Client\Server\ResourceBelongsToServer;
use Breefer\VersionChanger\Http\VersionController;
use Illuminate\Support\Facades\Route;

/*
| Endpoint: /api/client/extensions/breefer-version-changer/servers/{server}
*/
Route::group([
    'prefix' => '/servers/{server}',
    'middleware' => [ServerSubject::class, AuthenticateServerAccess::class, ResourceBelongsToServer::class],
], function () {
    Route::get('/installed', [VersionController::class, 'installed']);
    Route::get('/types', [VersionController::class, 'types']);
    Route::get('/types/{type}', [VersionController::class, 'versions'])->middleware('throttle:60,1');
    Route::get('/types/{type}/{version}', [VersionController::class, 'builds'])->middleware('throttle:60,1');
    Route::post('/install', [VersionController::class, 'install'])->middleware('throttle:6,1');
});
