<?php

declare(strict_types=1);

namespace App\Actions;

use App\Catalog;
use Crab\Http\Response;

/**
 * One product's page, or the not-found page.
 */
final readonly class ShowProduct
{
    public function __construct(private Catalog $catalog) {}

    public function handle(int $id): Response
    {
        $product = $this->catalog->find($id);
        if ($product === null) {
            return view('missing', status: 404);
        }

        return view('product', ['product' => $product]);
    }
}
