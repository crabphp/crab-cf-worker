<?php

declare(strict_types=1);

use Crab\App;
use Crab\Http\Request;

require __DIR__ . '/vendor/autoload.php';

// One long-lived application per isolate. The embed SAPI calls this function
// with native strings/arrays and reads its return value directly from Zend.
/** @var App $app */
$app = require __DIR__ . '/app.php';
$GLOBALS['crab_app'] = $app;

/** @return array{int, array<string, list<string>>, string} */
function crab_handle(string $method, string $target, array $headers, string $body): array
{
    $response = $GLOBALS['crab_app']->handle(new Request($method, $target, $headers, $body));
    return [$response->getStatusCode(), $response->getHeaders(), (string) $response->getBody()];
}
