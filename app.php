<?php

declare(strict_types=1);

use App\Setup;
use Crab\App;
use Crab\Arc\ArcPlugin;

// Describes the application. worker.php loads it once for each Worker isolate and hands it every request.
// There is no server here: Cloudflare receives the request, and the Worker in src/worker.js passes it on.
return App::configure(__DIR__)
    ->withPlugins([ArcPlugin::class])
    ->withSetup(Setup::class)
    ->withRouting(routes: 'routes/web.php', health: '/up')
    ->create();
