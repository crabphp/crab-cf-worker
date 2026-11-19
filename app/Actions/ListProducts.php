<?php

declare(strict_types=1);

namespace App\Actions;

use App\Catalog;

/**
 * GET /api/products: what an action returns is sent as JSON.
 */
final readonly class ListProducts
{
    public function __construct(private Catalog $catalog) {}

    /**
     * @return array{data: list<\App\Product>}
     */
    public function handle(): array
    {
        return ['data' => $this->catalog->all()];
    }
}
