<?php

declare(strict_types=1);

namespace App;

use Crab\Http\Response;

/**
 * Renders a page from a plain PHP template in resources/views, inside the layout.
 * Arc is not used: it checks each compiled template in a PHP process of its own, and a Worker cannot start one.
 */
final class Page
{
    /**
     * @param array<string, mixed> $data the template's variables
     */
    public static function render(string $view, string $title, array $data = [], int $status = 200): Response
    {
        $body = self::template($view, $data);

        return Response::html(self::template('layout', ['title' => $title, 'body' => $body]), $status);
    }

    /**
     * @param array<string, mixed> $data
     */
    private static function template(string $__view, array $__data): string
    {
        extract($__data, EXTR_SKIP);
        ob_start();
        try {
            require dirname(__DIR__) . "/resources/views/{$__view}.php";
        } catch (\Throwable $error) {
            ob_end_clean();
            throw $error;
        }

        return (string) ob_get_clean();
    }
}
