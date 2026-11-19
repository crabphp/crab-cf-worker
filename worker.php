<?php

declare(strict_types=1);

// The PHP side of the Worker. src/worker.js requires this file once for each isolate, which loads
// the application and leaves crab_handle() behind; every request after that only calls crab_handle().
// So the application stays loaded between requests, as it does under Crab's own server.

use Crab\App;
use Crab\Http\Request;

require __DIR__ . '/vendor/autoload.php';

// Nothing but the answer may reach the output: a warning printed there would break it.
ini_set('display_errors', 'stderr');

/** @var App $app */
$app = require __DIR__ . '/app.php';
$GLOBALS['crab_app'] = $app;

/**
 * Answers the request src/worker.js wrote to /tmp/request.json, and prints the response for it to read:
 * one line of JSON holding the status, the headers and the body in base64.
 */
function crab_handle(): void
{
    /** @var array{method: string, target: string, headers: array<string, string>, body: string} $in */
    $in = json_decode((string) file_get_contents('/tmp/request.json'), true, flags: JSON_THROW_ON_ERROR);

    /** @var App $app */
    $app = $GLOBALS['crab_app'];
    $response = $app->handle(new Request($in['method'], $in['target'], $in['headers'], base64_decode($in['body'])));

    echo json_encode([
        'status' => $response->getStatusCode(),
        'headers' => $response->getHeaders(),
        'body' => base64_encode((string) $response->getBody()),
    ], JSON_THROW_ON_ERROR);
}
