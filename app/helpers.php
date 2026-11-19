<?php

declare(strict_types=1);

/**
 * Escapes a value for HTML: every template writes what it shows through e().
 */
function e(string|int|float|null $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
