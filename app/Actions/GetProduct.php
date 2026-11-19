<?php

declare(strict_types=1);

namespace App\Actions;

use App\Catalog;
use Crab\Http\Response;

/**
 * GET /api/products/{id}
 */
final readonly class GetProduct
{
    public function __construct(private Catalog $catalog) {}

    public function handle(int $id): Response
    {
        $product = $this->catalog->find($id);
        if ($product === null) {
            return Response::json(['message' => 'No such product.'], 404);
        }

        return Response::json(['data' => $product]);
    }
}
