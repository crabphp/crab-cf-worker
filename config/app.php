<?php

declare(strict_types=1);

return [
    'name' => 'Crab on Workers',

    // Show the details of a failure to the client. Never in production.
    'debug' => env('APP_DEBUG', false),

    'url' => env('APP_URL', 'http://127.0.0.1:8787'),

    'timezone' => 'UTC',
];
