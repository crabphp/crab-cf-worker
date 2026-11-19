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
// Requests this isolate has answered; /debug shows it, which tells a new isolate from a warm one.
$GLOBALS['crab_requests'] = 0;

/** @return array{int, array<string, list<string>>, string} */
function crab_handle(string $method, string $target, array $headers, string $body): array
{
    $GLOBALS['crab_requests']++;
    // /raw/... is answered by plain PHP, without Crab, to compare the two.
    if ($target === '/raw' || str_starts_with($target, '/raw/') || str_starts_with($target, '/raw?')) {
        return raw_handle($method, (string) parse_url($target, PHP_URL_PATH));
    }
    $response = $GLOBALS['crab_app']->handle(new Request($method, $target, $headers, $body));
    return [$response->getStatusCode(), $response->getHeaders(), (string) $response->getBody()];
}

/**
 * The same products as the shop, with no framework: no routing, container, middleware or validation.
 *
 * @return array{int, array<string, list<string>>, string}
 */
function raw_handle(string $method, string $path): array
{
    $products = [
        ['id' => 1, 'name' => 'Hermit Mug', 'priceCents' => 1800],
        ['id' => 2, 'name' => 'Fiddler Notebook', 'priceCents' => 1200],
        ['id' => 3, 'name' => 'Coconut Backpack', 'priceCents' => 8900],
        ['id' => 4, 'name' => 'Ghost Crab Lamp', 'priceCents' => 4500],
        ['id' => 5, 'name' => 'Blue Swimmer Socks', 'priceCents' => 1500],
    ];
    if ($method !== 'GET' && $method !== 'HEAD') {
        return [405, ['content-type' => ['text/plain; charset=utf-8'], 'allow' => ['GET, HEAD']], "405 Method Not Allowed\n"];
    }
    if ($path === '/raw/api/products') {
        return [200, ['content-type' => ['application/json']], json_encode(['data' => $products], JSON_THROW_ON_ERROR)];
    }
    if ($path === '/raw') {
        $rows = '';
        foreach ($products as $product) {
            $rows .= '<li>' . htmlspecialchars($product['name']) . ' — $' . number_format($product['priceCents'] / 100, 2) . '</li>';
        }
        $html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Plain PHP</title>'
            . '<body style="font: 16px/1.5 system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem">'
            . '<h1>Plain PHP</h1><p>The same products, answered without Crab.</p><ul>' . $rows . '</ul>'
            . '<p><a href="/raw/api/products">/raw/api/products</a> · <a href="/">The Crab shop</a></p></body></html>';
        return [200, ['content-type' => ['text/html; charset=utf-8']], $html];
    }
    return [404, ['content-type' => ['text/plain; charset=utf-8']], "404 Not Found\n"];
}
