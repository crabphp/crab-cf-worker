<?php

declare(strict_types=1);

use App\Actions\GetProduct;
use App\Actions\ListProducts;
use App\Actions\PlaceOrder;
use App\Actions\ShowDebug;
use App\Actions\ShowHome;
use App\Actions\ShowPhpInfo;
use App\Actions\ShowProduct;
use Crab\Route;

// Pages, rendered by Arc.
Route::get('/', ShowHome::class);
Route::get('/products/{id}', ShowProduct::class);

// The pretend API.
Route::get('/api/products', ListProducts::class);
Route::get('/api/products/{id}', GetProduct::class);
Route::post('/api/orders', PlaceOrder::class);

// What this PHP is, and what this isolate has done.
Route::get('/debug', ShowDebug::class);
Route::get('/debug/phpinfo', ShowPhpInfo::class);
