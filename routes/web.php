<?php

declare(strict_types=1);

use App\Actions\GetProduct;
use App\Actions\ListProducts;
use App\Actions\PlaceOrder;
use App\Actions\ShowHome;
use App\Actions\ShowProduct;
use Crab\Route;

// Pages, rendered by Arc.
Route::get('/', ShowHome::class);
Route::get('/products/{id}', ShowProduct::class);

// The pretend API.
Route::get('/api/products', ListProducts::class);
Route::get('/api/products/{id}', GetProduct::class);
Route::post('/api/orders', PlaceOrder::class);
