<?php

use Breefer\VersionChanger\Support\AdminSettingsController;
use Illuminate\Support\Facades\Route;

/*
| Endpoint: /admin/extensions/breefer-version-changer
*/
Route::get('/', [AdminSettingsController::class, 'index']);
Route::post('/', [AdminSettingsController::class, 'save']);
