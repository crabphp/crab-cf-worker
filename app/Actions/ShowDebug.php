<?php

declare(strict_types=1);

namespace App\Actions;

use App\Page;
use Crab\Http\Response;
use Psr\Http\Message\ServerRequestInterface;

/**
 * GET /debug: what this PHP is and what this isolate has done. Public on purpose: an experiment with no secrets.
 */
final readonly class ShowDebug
{
    public function handle(ServerRequestInterface $request): Response
    {
        $extensions = get_loaded_extensions();
        sort($extensions);
        $headers = [];
        foreach ($request->getHeaders() as $name => $values) {
            $headers[$name] = implode(', ', $values);
        }
        ksort($headers);

        return Page::render('debug', 'Debug', [
            'runtime' => [
                'PHP' => PHP_VERSION,
                'SAPI' => PHP_SAPI,
                'OS' => PHP_OS . ' (' . php_uname('m') . ')',
                'Integer size' => PHP_INT_SIZE * 8 . '-bit (PHP_INT_MAX ' . PHP_INT_MAX . ')',
                'Zend Engine' => zend_version(),
                'Fibers' => class_exists(\Fiber::class) ? 'available' : 'not available',
                'OPcache' => function_exists('opcache_get_status') ? 'loaded' : 'not loaded',
            ],
            'isolate' => [
                'Requests answered by this isolate' => (string) ($GLOBALS['crab_requests'] ?? 0),
                'Memory in use' => self::bytes(memory_get_usage()),
                'Peak memory' => self::bytes(memory_get_peak_usage()),
                'Memory limit' => (string) ini_get('memory_limit'),
                'Files loaded' => (string) count(get_included_files()),
                'Classes declared' => (string) count(get_declared_classes()),
                'Time (UTC)' => gmdate('Y-m-d H:i:s'),
            ],
            'extensions' => $extensions,
            'headers' => $headers,
        ]);
    }

    private static function bytes(int $bytes): string
    {
        return number_format($bytes / 1048576, 2) . ' MiB';
    }
}
