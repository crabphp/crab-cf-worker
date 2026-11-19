<?php

declare(strict_types=1);

namespace App\Actions;

use Crab\Http\Response;

/**
 * GET /debug/phpinfo: PHP's own report, as it prints it.
 */
final readonly class ShowPhpInfo
{
    public function handle(): Response
    {
        ob_start();
        phpinfo();
        $info = (string) ob_get_clean();
        // The embed SAPI prints the report as text, not as HTML.
        if (!str_contains($info, '<html')) {
            $info = '<!doctype html><html lang="en"><meta charset="utf-8"><title>phpinfo()</title>'
                . '<body style="font: 13px/1.4 ui-monospace, monospace; margin: 2rem"><pre>'
                . htmlspecialchars($info, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</pre></body></html>';
        }

        return Response::html($info);
    }
}
