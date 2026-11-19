<?php

declare(strict_types=1);

namespace App\Http;

use Crab\Validation\Email;
use Crab\Validation\Range;

/**
 * The body of POST /api/orders, validated before the action runs.
 */
final readonly class OrderInput
{
    public function __construct(
        public int $product_id,
        #[Range(min: 1, max: 10)]
        public int $quantity,
        #[Email]
        public string $email,
    ) {}
}
